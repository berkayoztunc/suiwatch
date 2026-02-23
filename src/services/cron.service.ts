import { getTokenPrice, getSuiPrice } from "@7kprotocol/sdk-ts";
import { DatabaseService } from './database.service';
import { PriceService } from './price.service';

export class CronService {
    private static dbService: DatabaseService;

    static initialize(database: D1Database) {
        this.dbService = new DatabaseService(database);
        PriceService.initialize(database);
    }

    /**
     * Update SUI price every 5 minutes.
     * Uses 7k Protocol SDK as primary, falls back to CoinGecko.
     * Saves to both tokens table and price history.
     */
    static async updateSuiPrice(): Promise<void> {
        try {
            console.log('[CronService] Starting SUI price update job');

            // Try 7k Protocol SDK first
            let suiPrice: number | null = null;
            try {
                suiPrice = await getSuiPrice();
                console.log(`[CronService] 7k Protocol SUI price: ${suiPrice}`);
            } catch (error) {
                console.log('[CronService] 7k Protocol failed for SUI price:', error);
            }

            // Fallback to CoinGecko if 7k fails
            if (!suiPrice || isNaN(suiPrice) || !isFinite(suiPrice) || suiPrice <= 0) {
                console.log('[CronService] Falling back to CoinGecko for SUI price');
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000);
                    const response = await fetch(
                        'https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd',
                        { signal: controller.signal }
                    );
                    clearTimeout(timeout);
                    if (response.ok) {
                        const data = await response.json() as { sui?: { usd: number } };
                        suiPrice = data?.sui?.usd ?? null;
                        console.log(`[CronService] CoinGecko SUI price: ${suiPrice}`);
                    }
                } catch (error) {
                    console.error('[CronService] CoinGecko also failed:', error);
                }
            }
            
            if (suiPrice !== null && !isNaN(suiPrice) && isFinite(suiPrice) && suiPrice > 0) {
                console.log(`[CronService] Saving SUI price: ${suiPrice}`);
                // Save to price history
                await this.dbService.saveSuiPrice(suiPrice);
                // Also update the tokens table so wallet queries get fresh SUI price
                await this.dbService.saveToken({
                    coin_type: '0x2::sui::SUI',
                    price_usd: suiPrice,
                    last_update: Date.now(),
                    metadata: JSON.stringify({ decimals: 9, name: 'Sui', symbol: 'SUI' })
                });
                console.log('[CronService] Successfully saved SUI price to history and tokens');
            } else {
                console.log('[CronService] Invalid SUI price from all sources:', suiPrice);
            }
        } catch (error) {
            console.error('[CronService] Error updating SUI price:', error);
            throw error;
        }
    }

    /**
     * Update tokens with zero price every 30 minutes.
     * Uses PriceService.getTokenPrice which has multi-source fallback
     * (7k Protocol -> DexScreener -> Cetus DEX).
     */
    static async updateZeroPriceTokens(): Promise<void> {
        try {
            console.log('[CronService] Starting zero price token update job');
            
            // Get tokens with zero price or very stale data (> 1 hour)
            const tokens = await this.dbService.query<{ coin_type: string }>(
                'SELECT coin_type FROM tokens WHERE price_usd = 0 OR price_usd IS NULL'
            );
            
            console.log(`[CronService] Found ${tokens.length} tokens with zero/null price`);
            
            let updated = 0;
            let failed = 0;

            for (const token of tokens) {
                console.log(`[CronService] Processing token: ${token.coin_type}`);
                try {
                    // Use PriceService which has full multi-source fallback
                    const price = await PriceService.getTokenPrice(token.coin_type);
                    
                    if (price !== null && !isNaN(price) && isFinite(price) && price > 0) {
                        console.log(`[CronService] Updated price for ${token.coin_type}: ${price}`);
                        await this.dbService.query(
                            'UPDATE tokens SET price_usd = ?, last_update = ? WHERE coin_type = ?',
                            [price, Date.now(), token.coin_type]
                        );
                        updated++;
                    } else {
                        console.log(`[CronService] Could not get valid price for ${token.coin_type}`);
                        failed++;
                    }
                } catch (error) {
                    console.error(`[CronService] Error updating price for ${token.coin_type}:`, error);
                    failed++;
                }
            }
            
            console.log(`[CronService] Completed zero price update: ${updated} updated, ${failed} failed out of ${tokens.length}`);
        } catch (error) {
            console.error('[CronService] Error in updateZeroPriceTokens:', error);
        }
    }
}
