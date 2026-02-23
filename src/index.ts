/**
 * Main application file for the SUI Portfolio tracking service
 * This service provides APIs for tracking SUI wallet balances, token prices,
 * and historical data for the SUI ecosystem
 */

import { Hono } from "hono";
import { cors } from 'hono/cors'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { PriceService } from './services/price.service';
import { DatabaseService } from './services/database.service';
import { CronService } from './services/cron.service';
import { mmtService2 } from "./services/mmt2.service";
import { getTokenPrice, getTokenPrices, getSuiPrice } from "@7kprotocol/sdk-ts";
import { cetusService } from "./services/cetus.service";
import { deepbookMarketMaker } from "./services/deepbook.service";
import { createGraphQLServer } from './graphql/server';
import { GraphQLContext } from './graphql/context';
import { MmtSDK } from '@mmt-finance/clmm-sdk';
import { createMCPServer } from './mcp/server';

/**
 * Interface for Cloudflare D1 database bindings
 * Extends CloudflareBindings to include our D1 database instance
 */
interface Bindings extends CloudflareBindings {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Configure CORS middleware to allow cross-origin requests
 * This enables the API to be called from any domain
 */
app.use('*', cors({
  origin: '*', // Allow all origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
  credentials: true,
}))

/**
 * Export both the fetch handler for HTTP requests and scheduled function for cron jobs
 * The scheduled function runs two different cron jobs:
 * 1. Updates SUI price every 5 minutes
 * 2. Updates zero price tokens every 30 minutes
 */
export default {
  fetch: app.fetch,
  scheduled: async (
    event: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext
  ): Promise<void> => {
    CronService.initialize(env.DB);
    
    // SUI price update (every 5 minutes)
    if (event.cron === "*/5 * * * *") {
      console.log("Cron trigger started for updating SUI price");
      await CronService.updateSuiPrice();
    }
    
    // Zero price tokens update (every 30 minutes)
    if (event.cron === "*/30 * * * *") {
      console.log("Cron trigger started for updating zero price tokens");
      await CronService.updateZeroPriceTokens();
    }
  }
};

// Initialize services with database
app.use('*', async (c, next) => {
  PriceService.initialize(c.env.DB);
  CronService.initialize(c.env.DB);
  await next();
});

// SUI Mainnet client
const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

// Create GraphQL server
const graphqlServer = createGraphQLServer();

// GraphQL endpoint
app.all('/graphql', async (c) => {
  const db = new DatabaseService(c.env.DB);
  
  // Create GraphQL context
  const graphqlContext: GraphQLContext = {
    db,
    database: c.env.DB,
    suiClient: client,
    priceService: PriceService,
    cronService: CronService,
  };

  // Handle GraphQL request
  const response = await graphqlServer.handle(c.req.raw, graphqlContext);
  return response;
});

// MCP (Model Context Protocol) endpoint
app.post('/mcp', async (c) => {
  try {
    // Initialize services
    PriceService.initialize(c.env.DB);
    
    // Create MCP server
    const mcpServer = createMCPServer(c.env.DB, client);
    
    // Handle MCP request
    const response = await mcpServer.handleRequest(c.req.raw);
    
    return response;
  } catch (error: any) {
    console.error('[MCP] Error handling MCP request:', error);
    return c.json({
      success: false,
      error: error?.message || 'Failed to process MCP request'
    }, 500);
  }
});

// Cron trigger for updating zero price tokens (runs every minute)
app.get('/scheduled-tasks/update-zero-prices', async (c) => {
  try {
    await CronService.updateZeroPriceTokens();
    return c.json({ success: true, message: 'Zero price tokens update completed' });
  } catch (error) {
    console.error('Failed to update zero price tokens:', error);
    return c.json({ success: false, message: 'Failed to update zero price tokens' }, 500);
  }
});

// Types for wallet data
interface TokenData {
  coinType: string;
  balance: string;
  metadata?: {
    decimals: number;
    name: string;
    symbol: string;
    description: string;
    iconUrl?: string | null;
  };
}

interface WalletCache {
  tokens: TokenData[];
  lastUpdate: number;
}

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const walletCache = new Map<string, WalletCache>();


// Legacy price endpoint - redirects to the main /price/:tokenType handler below
app.get("/price-direct/:tokenAddress", async (c) => {
  const tokenAddress = c.req.param('tokenAddress');
  const tokenPrice = await getTokenPrice(tokenAddress,"0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC");
  // update token price in database
  const db = new DatabaseService(c.env.DB);
  console.log(`[API] Updating price for token: ${tokenAddress} with price: ${tokenPrice}`);

  await db.updateTokenPrice(tokenAddress,tokenPrice);
  return c.json({ message: "API is working!", tokenPrice });
})

app.get("/wallet-tokens/:walletAddress", async (c) => {
  const address = c.req.param('walletAddress');
    const coins = await client.getAllCoins({
      owner: address
    });
  return c.json({ message: "API is working!", coins });
})

/**
 * Updates SUI price in the database and tokens table
 */
app.get("/update-sui-price", async (c) => {
  try {
    // Get latest SUI price
    const suiPrice = await getSuiPrice();
    
    if (!suiPrice || suiPrice === 0) {
      return c.json({
        success: false,
        message: "Could not fetch SUI price"
      }, 500);
    }

    const db = new DatabaseService(c.env.DB);
    
    // Update SUI price in tokens table
    await db.updateTokenPrice("0x2::sui::SUI", suiPrice);
    
    // Save price history
    await db.saveSuiPriceHistory(suiPrice);

    return c.json({
      success: true,
      data: {
        price: suiPrice,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Error updating SUI price:", error);
    return c.json({
      success: false,
      error: error?.message || "Failed to update SUI price"
    }, 500);
  }
})

// Get wallet tokens
// Get token price endpoint
// Get SUI price history
app.get("/sui-price-history", async (c) => {
  try {
    const minutes = parseInt(c.req.query('minutes') || '60'); // Default to last 60 minutes
    const db = new DatabaseService(c.env.DB);
    const priceHistory = await db.getSuiPriceHistory(minutes);
    
    return c.json({
      success: true,
      data: {
        history: priceHistory.map(entry => ({
          price: entry.price_usd,
          timestamp: entry.created_at
        }))
      }
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error?.message || "Failed to fetch SUI price history"
    }, 500);
  }
});

app.get("/price/:tokenType", async (c) => {
  const tokenType = c.req.param('tokenType');
  console.log(`[API] Price request received for token: ${tokenType}`);
  
  const db = new DatabaseService(c.env.DB);
  console.log(`[API] Database service initialized for token: ${tokenType}`);
  
  try {
    // Check DB first - only return cache if token has a valid price and is not stale
    console.log(`[API] Checking database for token: ${tokenType}`);
    const token = await db.getToken(tokenType);
    
    if (token && token.price_usd > 0) {
      console.log(`[API] Found token in database: ${tokenType}`);
      const isStale = await db.isTokenStale(tokenType);
      console.log(`[API] Token data is${isStale ? '' : ' not'} stale`);
      
      if (!isStale) {
        console.log(`[API] Returning cached price for ${tokenType}: ${token.price_usd}`);
        return c.json({
          success: true,
          data: {
            tokenType,
            priceUSD: token.price_usd,
            metadata: token.metadata ? JSON.parse(token.metadata) : undefined,
            fromCache: true
          }
        });
      }
    }
    
    // Get fresh price
    const price = await PriceService.getTokenPrice(tokenType);
    
    if (price === null) {
      return c.json({
        success: false,
        error: "Price not available for this token"
      }, 404);
    }
    
    // Save to DB
    await db.saveToken({
      coin_type: tokenType,
      price_usd: price,
      last_update: Date.now(),
      metadata: JSON.stringify({
        // Add any metadata you want to store
      })
    });
    
    return c.json({
      success: true,
      data: {
        tokenType,
        priceUSD: price,
        fromCache: false
      }
    });
    
  } catch (error: any) {
    return c.json({
      success: false,
      error: error?.message || "Failed to fetch price"
    }, 500);
  }
});

app.get("/wallet/:address", async (c) => {
  PriceService.initialize(c.env.DB);
  const address = c.req.param('address');
  console.log(`[API] Wallet request received for address: ${address}`);
  
  const db = new DatabaseService(c.env.DB);
  console.log(`[API] Database service initialized for wallet: ${address}`);
  
  try {
    // Check DB first
    console.log(`[API] Checking database for wallet: ${address}`);


    // Fetch fresh data
    console.log(`[API] Fetching fresh coin data for wallet: ${address}`);
    
    // Fetch all pages of coins
    let allCoins = [];
    let hasNextPage = true;
    let nextCursor = null;
    
    while (hasNextPage) {
      const coinsResponse = await client.getAllCoins({
        owner: address,
        cursor: nextCursor
      });
      
      allCoins.push(...coinsResponse.data);
      hasNextPage = coinsResponse.hasNextPage;
      nextCursor = coinsResponse.nextCursor;
      
      console.log(`[API] Fetched ${coinsResponse.data.length} coins, has next page: ${hasNextPage}`);
    }
    
    console.log(`[API] Total coins fetched: ${allCoins.length}`);
    
    // Group coins by coinType and aggregate balances
    const coinsByType = new Map();
    for (const coin of allCoins) {
      const existingCoin = coinsByType.get(coin.coinType);
      if (!existingCoin) {
        // İlk kez karşılaşılan coin tipi
        coinsByType.set(coin.coinType, {
          ...coin,
          balance: BigInt(coin.balance).toString()
        });
      } else {
        // Aynı tip coin'in balance'ını topla
        const totalBalance = (BigInt(existingCoin.balance) + BigInt(coin.balance)).toString();
        coinsByType.set(coin.coinType, {
          ...coin,
          balance: totalBalance
        });
      }
    }
    
    // Convert back to array with only the latest versions
    const coins = { data: Array.from(coinsByType.values()) };

    // Get token data with prices
    console.log(`[API] Processing ${coins.data.length} coins for wallet: ${address}`);
    const tokenData = await Promise.all(coins.data.map(async (coin) => {
      try {
        console.log(`[API] Processing coin: ${coin.coinType}`);
        
        // Fetch metadata with retry
        let metadata = null;
        for (let i = 0; i < 3; i++) {
          try {
            console.log(`[API] Fetching metadata for ${coin.coinType} (attempt ${i + 1})`);
            metadata = await client.getCoinMetadata({ coinType: coin.coinType });
            if (metadata) {
              console.log(`[API] Successfully fetched metadata for ${coin.coinType}`);
              break;
            }
          } catch (error) {
            console.log(`[API] Metadata fetch error (attempt ${i + 1}) for ${coin.coinType}:`, error);
            if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }

        // Fetch price
        console.log(`[API] Fetching price for ${coin.coinType}`);
        const price = await PriceService.getTokenPrice(coin.coinType);
        console.log(`[API] Price for ${coin.coinType}: ${price}`);
        
        // Safe balance calculation
        let valueUSD = 0;
        try {
          console.log(`[API] Calculating USD value for ${coin.coinType}`);
          const balance = BigInt(coin.balance);
          const decimals = metadata?.decimals ?? 9;
          console.log(`[API] Using decimals: ${decimals} for ${coin.coinType}`);
          
          if (price !== null && !isNaN(price) && price > 0) {
            valueUSD = Number(balance) * price / Math.pow(10, decimals);
            console.log(`[API] Calculated USD value for ${coin.coinType}: ${valueUSD}`);
          } else {
            console.log(`[API] Skipping USD calculation for ${coin.coinType} due to invalid price`);
          }
        } catch (error) {
          console.log(`[API] Balance calculation error for ${coin.coinType}:`, error);
        }

        // Save token price to DB
        await db.saveToken({
          coin_type: coin.coinType,
          price_usd: price || 0,
          last_update: Date.now(),
          metadata: metadata ? JSON.stringify({
            decimals: metadata.decimals,
            name: metadata.name,
            symbol: metadata.symbol,
            description: metadata.description,
            iconUrl: metadata.iconUrl
          }) : undefined
        });

        console.log(`[API] Preparing response data for ${coin.coinType}`);
        return {
          coinType: coin.coinType,
          balance: coin.balance,
          valueUSD,
          price: price || 0,
          metadata: metadata ? {
            decimals: metadata.decimals,
            name: metadata.name,
            symbol: metadata.symbol,
            description: metadata.description,
            iconUrl: metadata.iconUrl
          } : undefined
        };
      } catch (error) {
        console.log(`[API] Error processing coin ${coin.coinType}:`, error);
        return {
          coinType: coin.coinType,
          balance: coin.balance,
          valueUSD: 0
        };
      }
    }));

    // Calculate total value
    console.log(`[API] Calculating total USD value for wallet: ${address}`);
    const totalValueUSD = tokenData.reduce((sum, token) => sum + token.valueUSD, 0);
    console.log(`[API] Total USD value for wallet ${address}: ${totalValueUSD}`);

    // Save to DB and get percentage change
    console.log(`[API] Saving wallet data to database for: ${address}`);
    await db.saveWallet({
      address,
      totalValueUSD,
      tokens: tokenData
    });
    
    // Save to history and get percentage change
    const tokensJson = JSON.stringify(tokenData);
    const { percentageChange } = await db.saveWalletHistory(address, totalValueUSD, tokensJson);
    console.log(`[API] Successfully saved wallet data and history for: ${address}`);

    return c.json({
      success: true,
      data: {
        address,
        totalValueUSD,
        percentageChange,
        tokens: tokenData
      },
      fromCache: false
    });

  } catch (error: any) {
    return c.json({
      success: false,
      error: error?.message || 'Unknown error occurred'
    }, 500);
  }
});

// Get MMT Finance positions for a wallet


app.get('/api/wallet/:address/mmt-positions', async (c) => {
  
  try {
    const address = c.req.param('address');
    
    // Validate address
    if (!address) {
      return c.json({
        success: false,
        error: 'Wallet address is required'
      }, 400);
    }

    // Get positions from MMT Finance
    const positions = await mmtService2.getUserPositions(address);
    
    return c.json({
      success: true,
      data: {
        address,
        positions
      }
    });

  } catch (error: any) {
    return c.json({
      success: false,
      error: error?.message || 'Failed to fetch MMT Finance positions'
    }, 500);
  }
});


// Get cetus Finance positions for a wallet
app.get('/api/wallet/:address/cetus-positions', async (c) => {
  try {
    const address = c.req.param('address');
    
    // Validate address
    if (!address) {
      return c.json({
        success: false,
        error: 'Wallet address is required'
      }, 400);
    }

    // Get positions from Cetus Finance
    const positions = await cetusService.getUserPositions(address);
    
    return c.json({
      success: true,
      data: {
        address,
        positions
      }
    });

  } catch (error: any) {  
    return c.json({
      success: false,
      error: error?.message || 'Failed to fetch Cetus Finance positions'
    }, 500);
  }
});


// Get DeepBook balances for a wallet
app.get('/api/wallet/:address/deepbook-balances', async (c) => {
  try {
    const address = c.req.param('address');
    
    // Validate address
    if (!address) {
      return c.json({
        success: false,
        error: 'Wallet address is required'
      }, 400);
    }

    // Get balances from DeepBook
    const balances = await deepbookMarketMaker.getDeepbookBalances(address);
    
    return c.json({
      success: true,
      data: {
        address,
        balances
      }
    });

  } catch (error: any) {  
    return c.json({
      success: false,
      error: error?.message || 'Failed to fetch DeepBook balances'
    }, 500);
  }
});

app.get('/mmt-tokens', async (c) => {
    const sdk = MmtSDK.NEW({
      network: 'mainnet',
    });
   const tokens = await sdk.Pool.getAllTokens();

   // update or insert tokens to database
    const db = new DatabaseService(c.env.DB);
    for (const token of tokens) {
      await db.saveToken({
        coin_type: token.coinType,
        price_usd: parseFloat(token.price),
        last_update: Date.now(),
        metadata: JSON.stringify({
          decimals: token.decimals,
          name: token.name,
          symbol: token.ticker,
        })
      });
    }
   return c.json({ tokens });
});


// mock airdrop list response
app.get('/api/airdrop-list', async (c) => {
  
  // get 3 token from database whitch price is lowr than 1 dollar with query

  const db = new DatabaseService(c.env.DB);
  const airdropList = await db.getAirdropTokenList(3);

  // şimdi bu 3 tokena map ile elligable amount ve status ekleyeceğiz
  const detailedAirdropList = airdropList.map(token => {

    const randomEligibility = Math.random() < 0.5; // %50 şansla eligible yap

    // next 12 day
    const randomdate = new Date();
    randomdate.setDate(randomdate.getDate() + Math.floor(Math.random() * 12) + 1);
    return {
      token,
      
      eligibleAmount: Math.floor(Math.random() * 1000), // random eligible amount
      status: randomEligibility ? 'eligible' : 'ineligible',
      expirationDate: randomdate.toISOString()
    };
  });

  return c.json({ success: true, data: detailedAirdropList });
});

// Export worker

// Export the scheduled function for Cloudflare Cron Triggers
export const worker = {
  async scheduled(
    controller: ScheduledController, 
    env: Bindings, 
    ctx: ExecutionContext
  ): Promise<void> {
    console.log("Cron trigger started for updating zero price tokens");
    CronService.initialize(env.DB);
    await CronService.updateZeroPriceTokens();
  },

  // Export the Hono app as the fetch handler
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  }
};

