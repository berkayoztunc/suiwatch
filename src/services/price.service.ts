import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { getTokenPrice, getTokenPrices, getSuiPrice } from "@7kprotocol/sdk-ts";
import { DatabaseService, TokenDB } from './database.service';

// Initialize SUI client
const client = new SuiClient({
    url: getFullnodeUrl('mainnet')
});

// ─── Types ───────────────────────────────────────────────────────────

interface DexScreenerResponse {
    pairs: DexScreenerPair[] | null;
}

interface DexScreenerPair {
    chainId: string;
    dexId: string;
    baseToken: { address: string; symbol: string };
    quoteToken: { address: string; symbol: string };
    priceUsd: string;
    liquidity: { usd: number };
}

interface GeckoTerminalResponse {
    data?: {
        attributes?: {
            price_usd: string | null;
            name: string;
            symbol: string;
        };
    };
}

interface CoinGeckoSearchResult {
    coins: Array<{
        id: string;
        symbol: string;
        name: string;
        platforms?: { [key: string]: string };
    }>;
}

// ─── Config ──────────────────────────────────────────────────────────

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 8000; // 8 seconds per external call

// Known CoinGecko IDs for popular SUI tokens
const COINGECKO_ID_MAP: Record<string, string> = {
    "0x2::sui::SUI": "sui",
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": "usd-coin",
    "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN": "tether",
    "0xa99b8952d4f7d947ea77fe0ecdcc9e5fc0bcab2841d6e2a5aa00c3044e5544b5::navx::NAVX": "navi-protocol",
    "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS": "cetus-protocol",
    "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK": "bucket-protocol",
    "0xbde4ba4c2e274a60ce15c1cfff9e5c42e136a8bc::afsui::AFSUI": "aftermath-staked-sui",
    "0xfe3afec26c59e874f3c1d60b8203cb3852d2bb2aa415df9548b8d688e6683f93::alpha::ALPHA": "alphafi",
};

// ─── Utility ─────────────────────────────────────────────────────────

/**
 * Extracts the contract address (package ID) from a full SUI coin type.
 * e.g. "0xabc...::module::TOKEN" -> "0xabc..."
 */
function extractContractAddress(coinType: string): string {
    const parts = coinType.split('::');
    return parts[0] || coinType;
}

/**
 * Extracts the token symbol from a full SUI coin type.
 * e.g. "0xabc...::module::TOKEN" -> "TOKEN"
 */
function extractSymbol(coinType: string): string {
    const parts = coinType.split('::');
    return parts[parts.length - 1] || coinType;
}

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Retry logic for API calls
 */
async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    delay: number = 800
): Promise<T | null> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) return null;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
    return null;
}

function isValidPrice(price: any): price is number {
    return typeof price === 'number' && !isNaN(price) && isFinite(price) && price > 0;
}

// ─── PriceService ────────────────────────────────────────────────────

export class PriceService {
    private static dbService: DatabaseService;

    static initialize(database: D1Database) {
        this.dbService = new DatabaseService(database);
    }

    // ── Cache ────────────────────────────────────────────────────────

    private static async getCachedPrice(tokenType: string): Promise<number | null> {
        try {
            const tokenData = await this.dbService.getToken(tokenType);
            if (!tokenData) return null;

            const now = Date.now();
            if (now - tokenData.last_update > CACHE_DURATION) return null;
            if (tokenData.price_usd === 0) return null;

            return tokenData.price_usd;
        } catch (error) {
            console.error('[PriceService] Cache read error:', error);
            return null;
        }
    }

    private static async setCachedPrice(tokenType: string, price: number): Promise<void> {
        try {
            await this.dbService.saveToken({
                coin_type: tokenType,
                price_usd: price,
                last_update: Date.now(),
                metadata: JSON.stringify({})
            });
        } catch (error) {
            console.error('[PriceService] Cache write error:', error);
        }
    }

    // ── Source 1: 7k Protocol SDK ────────────────────────────────────

    private static async get7kPrice(tokenType: string): Promise<number | null> {
        console.log(`[Price:7k] Trying ${extractSymbol(tokenType)}`);
        try {
            const price = await getTokenPrice(tokenType);
            if (isValidPrice(price)) {
                console.log(`[Price:7k] ✓ ${extractSymbol(tokenType)}: $${price}`);
                return price;
            }
        } catch (error) {
            console.log(`[Price:7k] ✗ ${extractSymbol(tokenType)} failed:`, error);
        }
        return null;
    }

    // ── Source 2: GeckoTerminal (CoinGecko on-chain data) ────────────

    private static async getGeckoTerminalPrice(tokenType: string): Promise<number | null> {
        console.log(`[Price:GeckoTerminal] Trying ${extractSymbol(tokenType)}`);
        return retryOperation(async () => {
            // GeckoTerminal uses the full coin type as address for SUI tokens
            const encodedAddress = encodeURIComponent(tokenType);
            const url = `https://api.geckoterminal.com/api/v2/networks/sui-network/tokens/${encodedAddress}`;
            const response = await fetchWithTimeout(url);

            if (!response.ok) {
                console.log(`[Price:GeckoTerminal] HTTP ${response.status} for ${extractSymbol(tokenType)}`);
                return null;
            }

            const data = await response.json() as GeckoTerminalResponse;
            const priceStr = data?.data?.attributes?.price_usd;

            if (priceStr) {
                const price = Number(priceStr);
                if (isValidPrice(price)) {
                    console.log(`[Price:GeckoTerminal] ✓ ${extractSymbol(tokenType)}: $${price}`);
                    return price;
                }
            }

            console.log(`[Price:GeckoTerminal] ✗ No price for ${extractSymbol(tokenType)}`);
            return null;
        });
    }

    // ── Source 3: DexScreener ────────────────────────────────────────

    private static async getDexScreenerPrice(tokenType: string): Promise<number | null> {
        console.log(`[Price:DexScreener] Trying ${extractSymbol(tokenType)}`);
        return retryOperation(async () => {
            // DexScreener search works best with the full coin type string
            const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(tokenType)}`;
            const response = await fetchWithTimeout(url);

            if (!response.ok) {
                console.log(`[Price:DexScreener] HTTP ${response.status}`);
                return null;
            }

            const data = await response.json() as DexScreenerResponse;

            if (!data.pairs || data.pairs.length === 0) {
                // Fallback: try searching by contract address only
                const contractAddr = extractContractAddress(tokenType);
                console.log(`[Price:DexScreener] No pairs with full type, trying contract: ${contractAddr}`);
                const url2 = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(contractAddr)}`;
                const response2 = await fetchWithTimeout(url2);
                if (!response2.ok) return null;

                const data2 = await response2.json() as DexScreenerResponse;
                if (!data2.pairs || data2.pairs.length === 0) {
                    console.log(`[Price:DexScreener] ✗ No pairs found for ${extractSymbol(tokenType)}`);
                    return null;
                }
                data.pairs = data2.pairs;
            }

            // Filter to SUI chain pairs only and pick highest liquidity
            const suiPairs = data.pairs
                .filter(p => p.chainId === 'sui' || !p.chainId)
                .filter(p => p.liquidity?.usd > 0);

            if (suiPairs.length === 0) {
                console.log(`[Price:DexScreener] ✗ No SUI pairs with liquidity for ${extractSymbol(tokenType)}`);
                return null;
            }

            const bestPool = suiPairs.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];
            const price = Number(bestPool.priceUsd);

            if (isValidPrice(price)) {
                console.log(`[Price:DexScreener] ✓ ${extractSymbol(tokenType)} on ${bestPool.dexId}: $${price} (liq: $${bestPool.liquidity.usd.toFixed(0)})`);
                return price;
            }

            return null;
        });
    }

    // ── Source 4: CoinGecko (by ID mapping or search) ────────────────

    private static async getCoinGeckoPrice(coinIdOrType: string): Promise<number | null> {
        // Check direct ID mapping first
        const knownId = COINGECKO_ID_MAP[coinIdOrType] || null;
        const coinId = knownId || coinIdOrType;

        // If it's a full coin type and not in the map, try to search CoinGecko
        if (!knownId && coinIdOrType.includes('::')) {
            return this.getCoinGeckoBySearch(coinIdOrType);
        }

        console.log(`[Price:CoinGecko] Trying ID: ${coinId}`);
        return retryOperation(async () => {
            const response = await fetchWithTimeout(
                `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
            );

            if (!response.ok) {
                console.log(`[Price:CoinGecko] HTTP ${response.status}`);
                return null;
            }

            const data = await response.json() as { [key: string]: { usd: number } };
            const price = data[coinId]?.usd;

            if (isValidPrice(price)) {
                console.log(`[Price:CoinGecko] ✓ ${coinId}: $${price}`);
                return price;
            }

            console.log(`[Price:CoinGecko] ✗ No price for ${coinId}`);
            return null;
        });
    }

    /**
     * Search CoinGecko for a SUI token by symbol, then fetch price.
     * Uses GeckoTerminal's coingecko_coin_id when available.
     */
    private static async getCoinGeckoBySearch(tokenType: string): Promise<number | null> {
        const symbol = extractSymbol(tokenType).toLowerCase();
        console.log(`[Price:CoinGecko:Search] Searching for "${symbol}"`);

        return retryOperation(async () => {
            // Step 1: First try GeckoTerminal to get coingecko_coin_id
            try {
                const encodedAddress = encodeURIComponent(tokenType);
                const gtUrl = `https://api.geckoterminal.com/api/v2/networks/sui-network/tokens/${encodedAddress}`;
                const gtRes = await fetchWithTimeout(gtUrl, 5000);
                if (gtRes.ok) {
                    const gtData = await gtRes.json() as any;
                    const cgId = gtData?.data?.attributes?.coingecko_coin_id;
                    if (cgId) {
                        console.log(`[Price:CoinGecko:Search] Found CoinGecko ID via GeckoTerminal: ${cgId}`);
                        const priceRes = await fetchWithTimeout(
                            `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`
                        );
                        if (priceRes.ok) {
                            const priceData = await priceRes.json() as { [key: string]: { usd: number } };
                            const price = priceData[cgId]?.usd;
                            if (isValidPrice(price)) {
                                console.log(`[Price:CoinGecko:Search] ✓ ${symbol} (${cgId}): $${price}`);
                                // Cache the ID mapping for future use
                                COINGECKO_ID_MAP[tokenType] = cgId;
                                return price;
                            }
                        }
                    }
                }
            } catch (e) {
                console.log(`[Price:CoinGecko:Search] GeckoTerminal lookup failed:`, e);
            }

            // Step 2: Fallback to CoinGecko search API
            try {
                const searchRes = await fetchWithTimeout(
                    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`
                );
                if (!searchRes.ok) return null;

                const searchData = await searchRes.json() as CoinGeckoSearchResult;
                if (!searchData.coins || searchData.coins.length === 0) {
                    console.log(`[Price:CoinGecko:Search] ✗ No coins found for "${symbol}"`);
                    return null;
                }

                // Find best match: prefer exact symbol match with SUI platform
                const match = searchData.coins.find(c =>
                    c.symbol.toLowerCase() === symbol &&
                    c.platforms && Object.keys(c.platforms).some(p => p.toLowerCase().includes('sui'))
                ) || searchData.coins.find(c => c.symbol.toLowerCase() === symbol);

                if (!match) {
                    console.log(`[Price:CoinGecko:Search] ✗ No symbol match for "${symbol}"`);
                    return null;
                }

                console.log(`[Price:CoinGecko:Search] Found match: ${match.id} (${match.symbol})`);

                const priceRes = await fetchWithTimeout(
                    `https://api.coingecko.com/api/v3/simple/price?ids=${match.id}&vs_currencies=usd`
                );
                if (!priceRes.ok) return null;

                const priceData = await priceRes.json() as { [key: string]: { usd: number } };
                const price = priceData[match.id]?.usd;

                if (isValidPrice(price)) {
                    console.log(`[Price:CoinGecko:Search] ✓ ${symbol} (${match.id}): $${price}`);
                    COINGECKO_ID_MAP[tokenType] = match.id;
                    return price;
                }
            } catch (e) {
                console.log(`[Price:CoinGecko:Search] Search failed:`, e);
            }

            return null;
        });
    }

    // ── Source 5: Hop Aggregator (SUI-native aggregator) ─────────────

    private static async getHopAggregatorPrice(tokenType: string): Promise<number | null> {
        console.log(`[Price:HopAgg] Trying ${extractSymbol(tokenType)}`);
        return retryOperation(async () => {
            try {
                // Hop aggregator quote API: get quote for 1 unit of token -> USDC
                const usdcType = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
                const url = `https://aggregator-api.hop.ag/api/v1/quote?token_in=${encodeURIComponent(tokenType)}&token_out=${encodeURIComponent(usdcType)}&amount_in=1000000000`;
                const response = await fetchWithTimeout(url, 6000);

                if (!response.ok) {
                    console.log(`[Price:HopAgg] HTTP ${response.status}`);
                    return null;
                }

                const data = await response.json() as any;
                // Hop returns amount_out in USDC minimal units (6 decimals)
                const amountOut = data?.amount_out_with_fee || data?.amount_out;
                if (amountOut) {
                    // We sent 1e9 (1 token with 9 decimals), got back USDC with 6 decimals
                    const price = Number(amountOut) / 1e6;
                    if (isValidPrice(price)) {
                        console.log(`[Price:HopAgg] ✓ ${extractSymbol(tokenType)}: $${price}`);
                        return price;
                    }
                }
            } catch (error) {
                console.log(`[Price:HopAgg] ✗ Failed:`, error);
            }
            return null;
        }, 1);
    }

    // ── Source 6: Aftermath Finance API ──────────────────────────────

    private static async getAftermathPrice(tokenType: string): Promise<number | null> {
        console.log(`[Price:Aftermath] Trying ${extractSymbol(tokenType)}`);
        return retryOperation(async () => {
            try {
                const url = `https://aftermath.finance/api/price-info`;
                const response = await fetchWithTimeout(url, 6000, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coins: [tokenType] })
                });

                if (!response.ok) {
                    console.log(`[Price:Aftermath] HTTP ${response.status}`);
                    return null;
                }

                const data = await response.json() as any;
                // Response format: { [coinType]: { price: number, ... } }
                const priceInfo = data?.[tokenType] || data?.[Object.keys(data)[0]];
                const price = priceInfo?.price;

                if (isValidPrice(price)) {
                    console.log(`[Price:Aftermath] ✓ ${extractSymbol(tokenType)}: $${price}`);
                    return price;
                }
            } catch (error) {
                console.log(`[Price:Aftermath] ✗ Failed:`, error);
            }
            return null;
        }, 1);
    }

    // ── Source 7: 7k Protocol getTokenPrices (batch) ─────────────────

    private static async get7kBatchPrice(tokenType: string): Promise<number | null> {
        console.log(`[Price:7k:Batch] Trying batch for ${extractSymbol(tokenType)}`);
        try {
            // getTokenPrices fetches multiple tokens at once
            const prices = await getTokenPrices([tokenType]);
            if (prices) {
                const priceMap = prices as any;
                // Try direct key lookup
                const price = priceMap[tokenType] || priceMap[Object.keys(priceMap)[0]];
                if (isValidPrice(price)) {
                    console.log(`[Price:7k:Batch] ✓ ${extractSymbol(tokenType)}: $${price}`);
                    return price;
                }
            }
        } catch (error) {
            console.log(`[Price:7k:Batch] ✗ Failed:`, error);
        }
        return null;
    }

    // ── Source 8: Calculate price via SUI pair on DexScreener ─────────

    private static async getDexScreenerViaSuiPrice(tokenType: string): Promise<number | null> {
        console.log(`[Price:DexScreener:SUI] Trying SUI-pair calculation for ${extractSymbol(tokenType)}`);
        return retryOperation(async () => {
            try {
                const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(tokenType)}`;
                const response = await fetchWithTimeout(url);
                if (!response.ok) return null;

                const data = await response.json() as DexScreenerResponse;
                if (!data.pairs || data.pairs.length === 0) return null;

                // Find a SUI pair where we can calculate USD price
                const suiPair = data.pairs.find(p =>
                    p.quoteToken?.address === '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI' ||
                    p.quoteToken?.symbol === 'SUI'
                );

                if (suiPair && suiPair.priceUsd) {
                    const price = Number(suiPair.priceUsd);
                    if (isValidPrice(price)) {
                        console.log(`[Price:DexScreener:SUI] ✓ ${extractSymbol(tokenType)}: $${price} (via ${suiPair.dexId})`);
                        return price;
                    }
                }

                // If any pair has priceUsd, use it
                for (const pair of data.pairs) {
                    const price = Number(pair.priceUsd);
                    if (isValidPrice(price)) {
                        console.log(`[Price:DexScreener:SUI] ✓ ${extractSymbol(tokenType)}: $${price} (any pair on ${pair.dexId})`);
                        return price;
                    }
                }
            } catch (error) {
                console.log(`[Price:DexScreener:SUI] ✗ Failed:`, error);
            }
            return null;
        }, 1);
    }

    // ── Main getTokenPrice with comprehensive fallback ───────────────

    /**
     * Get token price with aggressive multi-source fallback chain:
     *
     * Phase 1 (fast, primary sources):
     *   1. DB Cache (5 min TTL)
     *   2. 7k Protocol SDK
     *   3. GeckoTerminal
     *
     * Phase 2 (secondary sources):
     *   4. DexScreener (search + SUI-pair)
     *   5. CoinGecko (ID map + search via GeckoTerminal coin_id)
     *
     * Phase 3 (aggregator fallbacks):
     *   6. Aftermath Finance
     *   7. Hop Aggregator
     *   8. 7k Protocol batch API
     *
     * For SUI itself: CoinGecko direct -> 7k Protocol -> GeckoTerminal
     */
    static async getTokenPrice(tokenType: string): Promise<number | null> {
        try {
            console.log(`[PriceService] ── Getting price for ${extractSymbol(tokenType)} ──`);

            // ─ Phase 0: Cache ─
            const cachedPrice = await this.getCachedPrice(tokenType);
            if (cachedPrice !== null) {
                console.log(`[PriceService] Cache hit: $${cachedPrice}`);
                return cachedPrice;
            }

            let price: number | null = null;

            // ─ Special case: SUI token ─
            if (tokenType === "0x2::sui::SUI") {
                price = await this.getCoinGeckoPrice("sui");
                if (!isValidPrice(price)) price = await this.get7kPrice(tokenType);
                if (!isValidPrice(price)) price = await this.getGeckoTerminalPrice(tokenType);
                if (!isValidPrice(price)) price = await this.getDexScreenerPrice(tokenType);

                if (isValidPrice(price)) {
                    await this.setCachedPrice(tokenType, price!);
                    return price;
                }
                console.log(`[PriceService] ✗ Could not get SUI price from any source`);
                return null;
            }

            // ─ Phase 1: Primary fast sources ─
            price = await this.get7kPrice(tokenType);

            if (!isValidPrice(price)) {
                price = await this.getGeckoTerminalPrice(tokenType);
            }

            // ─ Phase 2: Secondary sources ─
            if (!isValidPrice(price)) {
                price = await this.getDexScreenerPrice(tokenType);
            }

            if (!isValidPrice(price)) {
                price = await this.getCoinGeckoPrice(tokenType);
            }

            // ─ Phase 3: Aggregator fallbacks ─
            if (!isValidPrice(price)) {
                price = await this.getAftermathPrice(tokenType);
            }

            if (!isValidPrice(price)) {
                price = await this.getHopAggregatorPrice(tokenType);
            }

            if (!isValidPrice(price)) {
                price = await this.get7kBatchPrice(tokenType);
            }

            // Last resort: DexScreener SUI-pair calculation
            if (!isValidPrice(price)) {
                price = await this.getDexScreenerViaSuiPrice(tokenType);
            }

            // ─ Cache and return ─
            if (isValidPrice(price)) {
                console.log(`[PriceService] ✓ Final price for ${extractSymbol(tokenType)}: $${price}`);
                await this.setCachedPrice(tokenType, price!);
                return price;
            }

            console.log(`[PriceService] ✗ No valid price found for ${extractSymbol(tokenType)} from any source`);
            return null;
        } catch (error) {
            console.error('[PriceService] Unexpected error:', error);
            return null;
        }
    }
}
