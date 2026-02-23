<template>
  <div class="min-h-screen bg-gray-900 text-white relative">
    <div class="absolute top-6 left-8 z-50 flex items-center gap-4">
      <span
        class="flex items-center gap-2 text-lg font-semibold text-white bg-gray-800/80 px-4 py-2 rounded-full shadow">
        <img src="https://cdn.prod.website-files.com/6425f546844727ce5fb9e5ab/659d970f061dbfe7ca0e47c0_emblem-sui-w.svg"
          alt="SUI" class="h-6 w-6 mr-1" style="filter: grayscale(0.2)" />
        SUI: <span class="ml-1">{{ suiMarketPriceDisplay }}</span>
        <span v-if="suiChangeDisplay !== null" :class="suiChangeColor + ' ml-2 flex items-center text-base font-semibold'
          ">
          <span v-if="suiChangeRaw !== null && suiChangeRaw > 0" class="mr-1">▲</span>
          <span v-else-if="suiChangeRaw !== null && suiChangeRaw < 0" class="mr-1">▼</span>
          {{ suiChangeDisplay }} <span class="text-xs">(24h)</span>
        </span>
      </span>
    </div>
    <div v-if="mode === 'landing'" class="min-h-screen flex items-center justify-center">
      <div class="w-full max-w-6xl px-6">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input v-model="landingQuery" @keyup.enter="submitLanding" type="text"
            placeholder="Search for any Token, Wallet or Feature"
            class="w-full bg-gray-800 border border-gray-700 rounded-full pl-16 pr-24 py-6 text-2xl placeholder-gray-400 focus:outline-none focus:border-gray-600 transition-colors" />

        </div>
      </div>
    </div>

    <div v-else class="pt-10">
      <div class="max-w-3xl mx-auto px-4">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input ref="topInput" v-model="topQuery" @keyup.enter="submitTop" type="text"
            placeholder="Search for any Token, Wallet or Feature"
            class="w-full bg-gray-800 border border-gray-700 rounded-full pl-12 pr-14 py-3 text-lg placeholder-gray-400 focus:outline-none focus:border-gray-600 transition-colors" />

          <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              @click="submitTop"
              class="h-9 w-9 rounded-full bg-emerald-500 hover:bg-emerald-600 focus:outline-none active:scale-95 transition-all flex items-center justify-center"
              type="button"
              aria-label="Refresh search"
            >
              <span class="text-white text-xl leading-none">⟳</span>
            </button>
          </div>
        </div>
      </div>

      <div class="max-w-7xl mx-auto px-4 mt-10">
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div
            class="lg:col-span-3 relative overflow-hidden rounded-3xl bg-gray-800/60 border border-gray-700/60 shadow-xl h-[420px]">
            <div
              class="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-emerald-700/10 to-emerald-500/20">
            </div>

            <div class="relative h-full p-6 pr-56">
              <div class="flex items-center">
                <h3 class="text-gray-200 text-xl font-semibold">Net Worth</h3>
              </div>

              <div class="mt-6">
                <div
                  class="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white flex items-baseline gap-3">
                  <span>{{ formattedUSD }}</span>
                  <span v-if="netWorthSUI" class="text-2xl font-semibold text-gray-400">{{ netWorthSUI }} SUI</span>
                </div>
                <div class="mt-2 flex items-center gap-3">
                  <span :class="percentageChangeColor +
                    ' text-3xl sm:text-4xl md:text-3xl font-bold'
                    ">
                    {{ percentageChangeDisplay }}
                  </span>
                  <span class="text-gray-400 text-lg font-medium">Holdings PnL</span>
                </div>
                <div class="mt-4 flex-col">
                  <!-- Token breakdown row -->
                  <div class="flex items-end gap-5 mb-2 mt-12 flex-wrap">
                    <template v-for="t in topTokens" :key="t.coinType">
                      <div class="flex flex-col items-center w-12">
                        <div class="h-9 w-9 rounded-full flex items-center justify-center mb-1 border-2"
                          :style="{ borderColor: t.color }">
                          <img v-if="t.iconUrl" :src="t.iconUrl" alt=""
                            class="h-full w-full object-cover rounded-full" />
                          <span v-else class="text-base font-bold" :style="{ color: t.color }">{{ t.symbolFirst
                            }}</span>
                        </div>
                        <div class="text-white text-sm font-semibold">
                          {{ t.symbol }}
                        </div>
                        <div class="text-gray-300 text-xs font-medium underline underline-offset-2">
                          {{ t.percentDisplay }}
                        </div>
                      </div>
                    </template>
                    <div v-if="othersTokens.length" class="flex flex-col items-center w-16">
                      <div class="h-9 w-9 rounded-full flex items-center justify-center mb-1 border-2"
                        style="border-color: #d946ef">
                        <span class="text-xl font-bold text-purple-300">...</span>
                      </div>
                      <div class="text-purple-300 text-sm font-semibold">
                        Others
                      </div>
                      <div class="text-gray-300 text-xs font-medium underline underline-offset-2">
                        {{ othersPercentDisplay }}
                      </div>
                    </div>
                  </div>
                  <!-- Chart bar -->
                  <div class="w-4/5 h-6 rounded-lg flex overflow-hidden mb-4"
                    style="background: rgba(255, 255, 255, 0.04)">
                    <template v-for="t in chartTokens" :key="t.coinType">
                      <div :style="{
                        width: t.percentBar,
                        background: t.color,
                        transition: 'width 0.4s',
                      }" class="h-full" :title="t.symbol + ' ' + t.percentDisplay"></div>
                    </template>
                  </div>
                  <div class="mt-2 text-gray-400 text-sm">
                    {{ tokensCount }} tokens detected
                  </div>
                </div>
              </div>

              <div class="mt-8"></div>

              <p v-if="errorMsg" class="mt-4 text-sm text-red-400">
                {{ errorMsg }}
              </p>
              <div v-if="loading" class="absolute inset-0 bg-gray-900/20 backdrop-blur-[1px]"></div>
            </div>

            <img src="/img/walrus.png" alt="Walrus mascot"
              class="pointer-events-none select-none absolute -bottom-4 -right-4 h-56 sm:h-64 md:h-72 lg:h-80 opacity-95"
              loading="lazy" decoding="async" />
          </div>

          <div class="lg:col-span-2 relative rounded-2xl bg-gray-800/50 border border-gray-700/60 shadow-xl h-[420px] p-4">
            <!-- Advice / actions panel -->
            <!-- gradient overlay matching left card but opposite direction -->
            <div class="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-bl from-transparent via-emerald-700/10 to-emerald-500/20"></div>
            <AdviceButton :tokens="tokensSorted" :totalUsd="totalValueUSD" :walletAddress="topQuery" />
          </div>
        </div>

        <div class="rounded-2xl bg-gray-800/50 border border-gray-700/60 shadow-xl mt-8">
          <div class="p-4 sm:p-6">
            <div class="flex items-center justify-between">
              <h3 class="text-gray-200 text-base sm:text-lg font-semibold">
                Token Portfolio
              </h3>
              <div class="text-gray-400 text-orange-400 text-sm font-bold">
                Total tokens: {{ tokensCount }}
              </div>
            </div>

            <div
              class="mt-4 hidden md:grid px-2 py-2 rounded-lg bg-gray-900/40 border border-gray-700/60 text-xs uppercase tracking-wide text-gray-400 md:[grid-template-columns:40px_1fr_140px_180px_160px_72px]">
              <div class="text-center">#</div>
              <div class="pl-2">Name</div>
              <div class="text-right">Price</div>
              <div class="text-right">Balance</div>
              <div class="text-right">USD Value</div>
              <div class="text-right">Actions</div>
            </div>

            <div class="mt-1 max-h-[26rem] overflow-y-auto">
              <div v-for="(t, idx) in pagedTokens" :key="t.coinType + '-' + idx"
                class="grid items-center px-2 py-3 border-b border-gray-800/60 last:border-0 md:[grid-template-columns:40px_1fr_140px_180px_160px_72px]">
                <div class="text-center text-gray-400">
                  {{ (currentPage - 1) * 10 + idx + 1 }}
                </div>
                <div class="pl-2 min-w-0">
                  <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="h-9 w-9 rounded-full bg-gray-700/60 flex items-center justify-center overflow-hidden shrink-0">
                    <img v-if="t.iconUrl" :src="t.iconUrl" alt="" class="h-full w-full object-cover" />
                    <span v-else class="text-sm font-semibold text-gray-300">{{
                      t.symbolFirst
                      }}</span>
                  </div>
                    <div class="min-w-0">
                      <div class="text-white font-medium leading-tight truncate">{{ t.symbol }}</div>
                      <div class="text-gray-400 text-[11px] leading-tight truncate">{{ t.name }}</div>
                    </div>
                  </div>
                </div>
                <div class="text-right text-gray-200">{{ t.priceDisplay }}</div>
                <div class="text-right text-white">{{ t.amountDisplay }} <span class="text-gray-400">{{ t.symbol }}</span></div>
                <!-- USD Value column -->
                <div class="text-right text-white">{{ t.valueUSDDisplay }}</div>
                <!-- Actions column: only the refresh button, centered -->
                <div class="text-right">
                  <div class="flex items-center justify-end h-full">
                    <button @click.prevent="refreshPrice(t.coinType)" :disabled="isRefreshing(t.coinType)" class="inline-flex items-center justify-center h-8 w-8 rounded-md bg-gray-700/60 hover:bg-gray-700" :title="isRefreshing(t.coinType) ? 'Refreshing...' : 'Refresh price'">
                      <span v-if="!isRefreshing(t.coinType)" class="text-base">⟳</span>
                      <span v-else class="animate-pulse text-base">…</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="md:hidden mt-3 divide-y divide-gray-700/60">
              <div v-for="(t, idx) in pagedTokens" :key="t.coinType + '-m-' + idx" class="py-3">
                <div class="flex items-center gap-3">
                  <div class="text-gray-400 w-6">
                    {{ (currentPage - 1) * 10 + idx + 1 }}
                  </div>
                  <div class="h-8 w-8 rounded-full bg-gray-700/60 flex items-center justify-center overflow-hidden">
                    <img v-if="t.iconUrl" :src="t.iconUrl" alt="" class="h-full w-full object-cover" />
                    <span v-else class="text-xs font-semibold text-gray-300">{{
                      t.symbolFirst
                      }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-white font-medium truncate">
                      {{ t.symbol }}
                    </div>
                    <div class="text-gray-400 text-[11px] truncate">
                      {{ t.name }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-white">{{ t.valueUSDDisplay }}</div>
                    <div class="text-gray-400 text-xs">
                      {{ t.amountDisplay }} {{ t.symbol }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between">
              <div class="text-gray-400 text-sm">
                Page {{ currentPage }} of {{ totalPages }}
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="px-3 py-1.5 rounded-md bg-gray-700/70 border border-gray-600/60 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                  :disabled="currentPage <= 1" @click="prevPage">
                  Prev
                </button>
                <button
                  class="px-3 py-1.5 rounded-md bg-gray-700/70 border border-gray-600/60 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                  :disabled="currentPage >= totalPages" @click="nextPage">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-2xl bg-gray-800/50 border border-gray-700/60 shadow-xl mt-8">
          <div class="p-4 sm:p-6">
            <div class="flex items-center justify-between">
              <h3 class="text-gray-200 text-base sm:text-lg font-semibold">
                Pool Checker
              </h3>
              <div class="text-gray-400 text-orange-400 text-sm font-bold"></div>
            </div>

            <div class="mt-4">
              <div v-if="poolLoading" class="text-sm text-gray-400">Loading pool positions…</div>
              <div v-else-if="poolError" class="text-sm text-red-400">{{ poolError }}</div>
              <div v-else>
                <template v-if="poolPositions.length">
                  <div class="rounded-md overflow-hidden">
                    <div class="p-4 bg-gray-900/20 border-b border-gray-700/40">
                      <div class="grid grid-cols-4 gap-4 text-sm text-gray-400 items-center">
                        <div class="pl-14">Pools</div>
                        <div class="text-center">TVL</div>
                        <div class="text-center">Total USD Value</div>
                        <div class="text-center">APR</div>
                      </div>
                    </div>

                    <div class="p-4 space-y-4">
                      <div v-for="pos in poolPositions" :key="pos.objectId" class="p-4 rounded-lg bg-gray-900/30 border border-gray-700/50">
                        <div class="grid grid-cols-4 gap-4 items-center">
                          <div class="flex items-center gap-3">
                            <div class="relative w-10 h-10">
                              <!-- larger primary icon -->
                              <img v-if="pos.pool?.tokenX?.iconUrl" :src="pos.pool.tokenX.iconUrl" alt="" class="h-10 w-10 rounded-full z-10 border-2 border-white/10 shadow-sm" />
                              <!-- secondary icon: match primary size and overlap neatly -->
                              <img v-if="pos.pool?.tokenY?.iconUrl" :src="pos.pool.tokenY.iconUrl" alt="" class="h-10 w-10 rounded-full absolute left-10 top-1/2 transform -translate-y-1/2 -translate-x-2 z-20 border-2 border-white/10 bg-gray-900" />
                            </div>
                            <div>
                              <div class="text-white ml-6 font-semibold uppercase">{{ pos.pool?.tokenX?.ticker }} / {{ pos.pool?.tokenY?.ticker }}</div>
                            </div>
                            <div class="ml-3">
                              <span v-if="pos.pool?.lpFeesPercent" class="px-2 py-1 bg-gray-900/60 text-xs rounded-full text-gray-200 border border-gray-700">{{ Number(pos.pool.lpFeesPercent).toFixed(3) }}%</span>
                            </div>
                          </div>

                          <div class="text-center">
                            <div class="text-gray-400 text-sm">&nbsp;</div>
                            <div class="text-white text-lg font-semibold">{{ pos.pool?.tvl ? formatUSD(Number(pos.pool.tvl)) : (pos.liquidity || '—') }}</div>
                          </div>

                          <div class="text-center">
                            <div class="text-gray-400 text-sm">&nbsp;</div>
                            <div class="text-white text-lg font-semibold">{{ (pos.valueUSD ?? pos.feesEarned?.valueUSD) ? formatUSD(pos.valueUSD ?? pos.feesEarned?.valueUSD) : '—' }}</div>
                          </div>

                          <div class="text-center">
                            <div class="text-white text-lg font-semibold">{{ formatAprWithPercent(pos.pool?.apy ?? pos.pool?.aprBreakdown?.total) }}</div>
                            <div class="text-gray-400 text-sm mt-1">APR</div>
                            <div class="mt-2">
                              <template v-if="pos.pool?.aprBreakdown?.rewards && pos.pool.aprBreakdown.rewards.length">
                                <div v-for="r in pos.pool.aprBreakdown.rewards" :key="r.coinType" class="text-white text-sm">
                                  <span class="text-gray-400 text-xs mr-2">{{ rewardTicker(r.coinType, pos) }}</span>
                                  <span class="font-medium">{{ formatAprWithPercent(r.apr) }} · {{ formatNumber(r.amountPerDay) }}/day</span>
                                </div>
                              </template>
                              <template v-else-if="pos.pool?.rewarders && pos.pool.rewarders.length">
                                <div v-for="(r, idx) in pos.pool.rewarders" :key="idx" class="text-white text-sm">
                                  <span class="text-gray-400 text-xs mr-2">{{ rewardTicker(r.coin_type, pos) }}</span>
                                  <span class="font-medium">{{ r.hasEnded ? 'ended' : 'active' }}</span>
                                </div>
                              </template>
                            </div>
                          </div>

                          
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <div v-else class="text-sm text-gray-400">No pools found.</div>
              </div>
            </div>
          </div>
        </div>

         <div class="rounded-2xl bg-gray-800/50 border border-gray-700/60 shadow-xl mb-8 mt-8">
          <div class="p-4 sm:p-6">
            <div class="flex items-center justify-between">
              <h3 class="text-gray-200 text-base sm:text-lg font-semibold">
                Airdrop Checker
              </h3>
              <div class="text-gray-400 text-orange-400 text-sm font-bold">
                
              </div>
            </div>

            <div class="mt-4">
              <div class="flex items-center justify-between">
                <div class="text-sm text-gray-400">Airdrops detected for demo data</div>
                <div class="text-gray-400 text-sm">{{ airdrops.length }} airdrops - {{ formatUSDComma(totalAirdropsUSD) }}</div>
              </div>

              <div class="mt-4">
                <div v-if="airdropLoading" class="text-sm text-gray-400">Loading airdrops…</div>
                <div v-else-if="airdropError" class="text-sm text-red-400">{{ airdropError }}</div>
                <div v-else>
                  <div class="mt-4 hidden md:grid px-2 py-3 rounded-lg bg-gray-900/40 border border-gray-700/60 text-xs uppercase tracking-wide text-gray-400 md:[grid-template-columns:120px_1fr_220px_140px_160px]">
                    <div class="pl-2">Date</div>
                    <div class="pl-12">Airdrop</div>
                    <div>Asset</div>
                    <div class="text-center">Status</div>
                    <div class="text-right">Amount</div>
                  </div>

                  <div class="mt-1 max-h-[28rem] overflow-y-auto">
                    <div v-for="(a, idx) in airdrops" :key="a.id || idx" class="grid items-center px-2 py-4 border-b border-gray-800/60 last:border-0 md:[grid-template-columns:120px_1fr_220px_140px_160px]">
                      <div class="pl-2 text-gray-300 text-sm">
                        <div v-if="a.date" class="text-white font-semibold text-sm">{{ formatAirdropDate(a.date) }}</div>
                        <div v-if="a.expirationDate" class="text-gray-400 text-xs mt-1">Exp: {{ formatAirdropDate(a.expirationDate) }}</div>
                      </div>

                      <!-- Airdrop project -->
                      <div class="min-w-0 pl-12">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="h-9 w-9 rounded-full bg-gray-700/60 flex items-center justify-center overflow-hidden shrink-0">
                            <img v-if="getAirdropIcon(a, 'project')" :src="getAirdropIcon(a, 'project')" alt="" class="h-full w-full object-cover" />
                            <span v-else class="text-sm font-semibold text-gray-300">{{ (a.project?.symbol || a.project?.name || '?').slice(0,2) }}</span>
                          </div>
                          <div class="min-w-0">
                            <div class="text-white font-medium leading-tight truncate">{{ a.project?.name || a.title || a.name }}</div>
                            <div class="text-gray-400 text-[11px] leading-tight truncate">{{ a.subtitle || a.project?.subtitle || '' }}</div>
                          </div>
                        </div>
                      </div>

                      <!-- Asset column -->
                      <div class="min-w-0">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="h-8 w-8 rounded-full bg-gray-700/60 flex items-center justify-center overflow-hidden shrink-0">
                            <img v-if="getAirdropIcon(a, 'token')" :src="getAirdropIcon(a, 'token')" alt="" class="h-full w-full object-cover" />
                            <span v-else class="text-xs font-semibold text-gray-300">{{ (a.token?.metadata?.symbol || a.asset || '?').slice(0,3) }}</span>
                          </div>
                          <div class="min-w-0">
                            <div class="text-white font-medium truncate">{{ a.token?.metadata?.symbol || a.asset || a.token?.symbol }}</div>
                            <div class="text-gray-400 text-[11px] truncate">{{ a.token?.metadata?.name || a.assetName || '' }}</div>
                          </div>
                        </div>
                      </div>

                      <!-- Status -->
                      <div class="text-center">
                        <div :class="['inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold', a.status === 'eligible' ? 'bg-emerald-700/20 text-emerald-300 border border-emerald-700/30' : 'bg-gray-700/30 text-gray-200 border border-gray-700/50']">
                          {{ capitalizeStatus(a.status) }}
                        </div>
                      </div>

                      <!-- Amount -->
                      <div class="text-right">
                        <div class="text-white font-semibold text-lg">{{ formatTokenAmountFromAirdrop(a) }} {{ a.token?.metadata?.symbol || a.asset }}</div>
                        <div class="text-gray-400 text-sm mt-1">{{ formatUSD(a.usdValue || a.estimatedUsd || a.valueUSD) }}</div>
                      </div>

                      <!-- Action column removed -->
                    </div>
                  </div>
                </div>
              </div>
            
            </div>
         
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from "vue";

// SUI 24h change fetch logic
const suiChangeRaw = ref<number | null>(null);
const suiChangeDisplay = computed(() => {
  if (suiChangeRaw.value === null) return null;
  const sign = suiChangeRaw.value > 0 ? "+" : "";
  return `${sign}${suiChangeRaw.value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}%`;
});
const suiChangeColor = computed(() => {
  if (suiChangeRaw.value === null) return "";
  return suiChangeRaw.value >= 0 ? "text-green-400" : "text-red-400";
});
// SUI market price fetch logic
const suiMarketPrice = ref<number | null>(null);
const suiMarketPriceDisplay = computed(() =>
  suiMarketPrice.value !== null
    ? suiMarketPrice.value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 4,
    })
    : "--"
);

async function fetchSuiMarketPrice() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=sui"
    );
    const arr = await res.json();
    const data = Array.isArray(arr) ? arr[0] : null;
    suiMarketPrice.value = data?.current_price ?? null;
    suiChangeRaw.value =
      typeof data?.price_change_percentage_24h === "number"
        ? data.price_change_percentage_24h
        : null;
  } catch {
    suiMarketPrice.value = null;
    suiChangeRaw.value = null;
  }
}

onMounted(() => {
  fetchSuiMarketPrice();
  // also load demo airdrops
  try { fetchAirdrops(); } catch (e) { /* silent */ }
  setInterval(fetchSuiMarketPrice, 60000); // refresh every 60s
});
import * as AdviceButtonRaw from "./components/AdviceButton.vue";

// Some TypeScript setups flag SFCs as having no default export; normalize here
const AdviceButton = (AdviceButtonRaw as any).default || (AdviceButtonRaw as any);

// Net worth in SUI
const suiToken = computed(() =>
  tokensSorted.value.find((t) => t.symbol?.toUpperCase() === "SUI")
);
const suiPrice = computed(() => {
  const t = suiToken.value;
  return t &&
    typeof t.priceDisplay === "string" &&
    t.priceDisplay.startsWith("$")
    ? Number(t.priceDisplay.replace(/[^\d.]/g, ""))
    : typeof t?.valueUSD === "number" &&
      typeof t?.amount === "number" &&
      t.amount > 0
      ? t.valueUSD / t.amount
      : null;
});
const netWorthSUI = computed(() => {
  const usd = totalValueUSD.value;
  const price = suiPrice.value;
  if (!usd || !price || price === 0) return "";
  return (usd / price).toLocaleString("en-US", { maximumFractionDigits: 2 });
});
// Top tokens breakdown logic
const TOP_N = 5;
const topTokens = computed(() => {
  return chartTokens.value.slice(0, TOP_N).map((t, idx) => {
    const token = tokensSorted.value[idx] || {};
    return {
      ...t,
      iconUrl: (token as any)?.iconUrl ?? "",
      symbolFirst: ((token as any)?.symbol || "?").slice(0, 1).toUpperCase(),
    };
  });
});

const othersTokens = computed(() => chartTokens.value.slice(TOP_N));
const othersPercent = computed(() =>
  othersTokens.value.reduce((sum, t) => sum + t.percent, 0)
);
const othersPercentDisplay = computed(
  () =>
    othersPercent.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) +
    "%"
);
// Chart color palette
const chartColors = [
  "#6EE7B7",
  "#A7F3D0",
  "#FDE68A",
  "#FCA5A5",
  "#C4B5FD",
  "#F9A8D4",
  "#FCD34D",
  "#93C5FD",
  "#F87171",
  "#FBBF24",
  "#34D399",
  "#818CF8",
  "#F472B6",
  "#F59E42",
  "#A3E635",
  "#F43F5E",
  "#F3F4F6",
];

const chartTokens = computed(() => {
  const tokens = tokensSorted.value;
  const total = tokens.reduce(
    (sum, t) => sum + (typeof t.valueUSD === "number" ? t.valueUSD : 0),
    0
  );
  return tokens.map((t, idx) => {
    const percent = total > 0 ? (t.valueUSD / total) * 100 : 0;
    return {
      symbol: t.symbol,
      coinType: t.coinType,
      percent,
      percentDisplay:
        percent.toLocaleString("en-US", { maximumFractionDigits: 2 }) + "%",
      percentBar: percent > 0.5 ? percent + "%" : "0.5%", // minimum width for visibility
      color: chartColors[idx % chartColors.length],
    };
  });
});
const percentageChangeRaw = computed(() => {
  const r: any = result.value;
  const v = r?.data?.percentageChange;
  return typeof v === "number" ? v : null;
});

const percentageChangeDisplay = computed(() => {
  const v = percentageChangeRaw.value;
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  // Show 2 decimals, use comma for thousands
  return `${sign}${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
});

const percentageChangeColor = computed(() => {
  const v = percentageChangeRaw.value;
  if (v == null) return "";
  return v >= 0 ? "text-green-400" : "text-red-400";
});

type Mode = "landing" | "top";
const mode = ref<Mode>("landing");
const landingQuery = ref("");
const topQuery = ref("");
const topInput = ref<HTMLInputElement | null>(null);

const loading = ref(false);
const errorMsg = ref("");
const lastUrl = ref("");
const result = ref<unknown | null>(null);

const refreshing = ref<Record<string, boolean>>({});

const API_BASE = import.meta.env.VITE_API_BASE || "https://suiport.mailberkayoztunc.workers.dev";
const PRICE_ENDPOINT = `${API_BASE}/price`;

function isRefreshing(coinType: any) {
  if (!coinType) return false;
  return !!refreshing.value[String(coinType)];
}

async function refreshPrice(coinType: any) {
  if (!coinType) return;
  try {
    refreshing.value[String(coinType)] = true;
    const url = `${PRICE_ENDPOINT}/${encodeURIComponent(String(coinType))}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const data: any = (result.value as any)?.data;
    if (!data || !Array.isArray(data.tokens)) return;
    const idx = data.tokens.findIndex(
      (x: any) => String(x?.coinType) === String(coinType)
    );
    if (idx === -1) return;
    const token = data.tokens[idx];

    const pricePerToken =
      typeof json?.price === "number"
        ? json.price
        : typeof json?.priceUSD === "number"
          ? json.priceUSD
          : undefined;
    const valueUSDFromApi =
      typeof json?.valueUSD === "number" ? json.valueUSD : undefined;

    const humanAmount = toHumanAmount(
      token?.balance,
      token?.metadata?.decimals
    );

    if (typeof pricePerToken === "number") {
      const newVal = pricePerToken * (isFinite(humanAmount) ? humanAmount : 0);
      data.tokens.splice(idx, 1, { ...token, valueUSD: newVal });
    } else if (typeof valueUSDFromApi === "number") {
      data.tokens.splice(idx, 1, { ...token, valueUSD: valueUSDFromApi });
    } else if (typeof json === "number") {
      const newVal = json * (isFinite(humanAmount) ? humanAmount : 0);
      data.tokens.splice(idx, 1, { ...token, valueUSD: newVal });
    }

    result.value = { ...(result.value as any) };
  } catch (err) {
    console.error("refreshPrice error", err);
  } finally {
    refreshing.value[String(coinType)] = false;
  }
}

const BASE_URL = `${API_BASE}/wallet`;

async function fetchWallet(address: string) {
  const addr = address.trim();
  if (!addr) return;
  if (loading.value) return;
  // start pool positions fetch concurrently
  fetchPoolPositions(addr);
  const url = `${BASE_URL}/${encodeURIComponent(addr)}`;
  loading.value = true;
  errorMsg.value = "";
  lastUrl.value = url;
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    result.value = json;
  } catch (err: any) {
    errorMsg.value = err?.message ?? "Request failed";
    result.value = null;
  } finally {
    loading.value = false;
  }
}

// Pool checker integration
const POOL_BASE = `${API_BASE}/api/wallet`;
const poolLoading = ref(false);
const poolError = ref<string | null>(null);
const poolResult = ref<any | null>(null);
const poolPositions = computed<any[]>(() => {
  return Array.isArray(poolResult.value?.data?.positions)
    ? poolResult.value.data.positions
    : [];
});

function shortId(id: any) {
  try {
    const s = String(id || "");
    if (s.length <= 16) return s;
    return s.slice(0, 8) + "…" + s.slice(-6);
  } catch {
    return String(id);
  }
}

async function fetchPoolPositions(address: string) {
  const addr = String(address || "").trim();
  if (!addr) {
    poolResult.value = null;
    poolError.value = null;
    return;
  }
  poolLoading.value = true;
  poolError.value = null;
  try {
    const url = `${POOL_BASE}/${encodeURIComponent(addr)}/mmt-positions`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    poolResult.value = json;
  } catch (err: any) {
    poolError.value = err?.message ?? "Pool request failed";
    poolResult.value = null;
  } finally {
    poolLoading.value = false;
  }
}

function submitLanding() {
  const q = landingQuery.value.trim();
  if (!q) return;
  topQuery.value = q;
  mode.value = "top";
  nextTick(() => topInput.value?.focus());
  fetchWallet(q);
}

function submitTop() {
  const q = topQuery.value.trim();
  if (!q) return;
  fetchWallet(q);
}

const totalValueUSD = computed<number | null>(() => {
  const r: any = result.value;
  const v = r?.data?.totalValueUSD;
  return typeof v === "number" ? v : null;
});

function formatUSD(n: number | null | undefined) {
  if (typeof n !== "number" || !isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatNumber(n: any) {
  const num = typeof n === 'number' ? n : Number(n);
  if (!isFinite(num)) return String(n ?? '—');
  if (Math.abs(num) >= 1000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(num);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(num);
}

// Format APR values to two decimals and use comma as decimal separator, include percent sign
function formatAprWithPercent(v: any) {
  if (v === null || v === undefined) return '—';
  const asNum = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!isFinite(asNum)) return '—';
  // fixed two decimals, replace decimal point with comma
  const s = Number(asNum).toFixed(2).replace('.', ',');
  return s + '%';
}

function rewardTicker(coinType: any, pos: any) {
  try {
    const ct = String(coinType || '');
    // try to match tokenX/tokenY coinType
    const tx = pos?.pool?.tokenX?.coinType;
    const ty = pos?.pool?.tokenY?.coinType;
    if (tx && String(tx) === ct) return pos.pool.tokenX.ticker || shortId(ct);
    if (ty && String(ty) === ct) return pos.pool.tokenY.ticker || shortId(ct);
    // fallback: use last segment after :: and remove module prefix if present
    const parts = ct.split('::');
    const last = parts[parts.length - 1] || ct;
    // sometimes coin type has `x_sui::X_SUI` or `usdc::USDC` — prefer uppercase token
    return last.toUpperCase();
  } catch {
    return String(coinType || '');
  }
}

const formattedUSD = computed(() => formatUSD(totalValueUSD.value));

const tokensRaw = computed<any[]>(() => {
  const r: any = result.value;
  return Array.isArray(r?.data?.tokens) ? r.data.tokens : [];
});

const tokensMerged = computed<any[]>(() => {
  const map = new Map<string, any>();
  const others: any[] = [];
  for (const t of tokensRaw.value) {
    const key = t && t.coinType ? String(t.coinType) : null;
    const bal = (() => {
      try {
        return BigInt(String(t?.balance ?? "0"));
      } catch {
        return BigInt(0);
      }
    })();
    const val = typeof t?.valueUSD === "number" ? t.valueUSD : 0;

    if (key) {
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { ...t, balanceBig: bal, valueUSD: val });
      } else {
        cur.balanceBig = cur.balanceBig + bal;
        cur.valueUSD = (cur.valueUSD || 0) + val;
      }
    } else {
      others.push({ ...t, balanceBig: bal, valueUSD: val });
    }
  }
  const merged = Array.from(map.values()).map((e) => ({
    ...e,
    balance: e.balanceBig.toString(),
  }));
  const tail = others.map((e) => ({ ...e, balance: e.balanceBig.toString() }));
  return [...merged, ...tail];
});

function toHumanAmount(balanceStr: any, decimals: any) {
  const bal = Number(balanceStr);
  const dec = Number(decimals);
  if (!isFinite(bal) || !isFinite(dec)) return 0;
  return bal / Math.pow(10, dec);
}

function formatTokenAmount(amount: number) {
  if (!isFinite(amount)) return "0";
  if (amount >= 1000)
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(amount);
  if (amount >= 1)
    return amount.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (amount === 0) return "0";
  return amount.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatPriceUSD(n: number | null | undefined) {
  if (typeof n !== "number" || !isFinite(n) || n <= 0) return "—";
  const decimals = n < 1 ? 6 : 4;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: decimals })}`;
}

const tokensEnriched = computed(() =>
  tokensMerged.value.map((t: any) => {
    const symbol = t?.metadata?.symbol ?? "";
    const name = t?.metadata?.name ?? "";
    const coinType = t?.coinType ?? symbol;
    
    // Automatically set SUI logo for SUI token
    let iconUrl = t?.metadata?.iconUrl || "";
    if (coinType === "0x2::sui::SUI") {
      iconUrl = "https://cdn.prod.website-files.com/6425f546844727ce5fb9e5ab/659d970f061dbfe7ca0e47c0_emblem-sui-w.svg";
    }
    
    const amount = toHumanAmount(t?.balance, t?.metadata?.decimals);
    const valueUSDRaw = typeof t?.valueUSD === "number" ? t.valueUSD : 0;
    const priceUSD =
      amount > 0 && valueUSDRaw > 0 ? valueUSDRaw / amount : undefined;
    const valueUSDFinal =
      valueUSDRaw > 0 ? valueUSDRaw : priceUSD ? priceUSD * amount : 0;
    return {
      coinType,
      symbol,
      name,
      iconUrl,
      amount,
      valueUSD: valueUSDFinal,
      amountDisplay: formatTokenAmount(amount),
      valueUSDDisplay: valueUSDFinal > 0 ? formatUSD(valueUSDFinal) : "—",
      priceDisplay: formatPriceUSD(priceUSD),
      symbolFirst: (symbol || "?").slice(0, 1).toUpperCase(),
    };
  })
);

const tokensSorted = computed(() =>
  [...tokensEnriched.value].sort(
    (a, b) => b.valueUSD - a.valueUSD || b.amount - a.amount
  )
);

const tokensCount = computed(() => tokensSorted.value.length);

const pageSize = 10;
const currentPage = ref(1);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(tokensSorted.value.length / pageSize))
);

watch(tokensSorted, () => {
  currentPage.value = 1;
});

const pagedTokens = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  const end = start + pageSize;
  return tokensSorted.value.slice(start, end);
});

function prevPage() {
  if (currentPage.value > 1) currentPage.value -= 1;
}
function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value += 1;
}

// --- Airdrop Checker state & helpers ---
const airdrops = ref<any[]>([]);
const airdropLoading = ref(false);
const airdropError = ref<string | null>(null);
const AIRDROP_ENDPOINT = `${API_BASE}/api/airdrop-list`;

const totalAirdropsUSD = computed(() => {
  return airdrops.value.reduce((sum, a) => {
    const v = typeof a?.usdValue === 'number' ? a.usdValue : typeof a?.estimatedUsd === 'number' ? a.estimatedUsd : typeof a?.valueUSD === 'number' ? a.valueUSD : 0;
    return sum + (isFinite(Number(v)) ? Number(v) : 0);
  }, 0);
});

function formatUSDComma(n: number | null | undefined) {
  if (typeof n !== 'number' || !isFinite(n)) return '$0,00';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

function formatAirdropDate(d: any) {
  try {
    const dt = d ? new Date(d) : null;
    if (!dt || Number.isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(d || '-');
  }
}

function capitalizeStatus(s: any) {
  if (!s) return '-';
  try {
    const s2 = String(s);
    return s2.charAt(0).toUpperCase() + s2.slice(1);
  } catch {
    return String(s);
  }
}

function formatTokenAmountFromAirdrop(a: any) {
  // prefer explicit eligibleAmount, otherwise token balance (humanized)
  if (typeof a?.eligibleAmount === 'number') return formatTokenAmount(a.eligibleAmount);
  if (typeof a?.amount === 'number') return formatTokenAmount(a.amount);
  try {
    const bal = a?.token?.balance ?? a?.balance ?? 0;
    const dec = a?.token?.metadata?.decimals ?? 6;
    const human = toHumanAmount(bal, dec);
    return formatTokenAmount(human);
  } catch {
    return String(a?.eligibleAmount ?? a?.amount ?? '0');
  }
}

async function fetchAirdrops() {
  airdropLoading.value = true;
  airdropError.value = null;
  try {
    const res = await fetch(AIRDROP_ENDPOINT, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // support either { data: [...] } or direct array
    const data = json?.data ?? json ?? [];
    airdrops.value = Array.isArray(data) ? data : (Array.isArray(data?.airdrops) ? data.airdrops : []);
    // compute usdValue for each airdrop when possible
    airdrops.value = airdrops.value.map((a: any) => {
      try {
        const token = a?.token ?? {};
        const price = typeof token?.priceUSD === 'number' ? token.priceUSD : typeof token?.metadata?.priceUSD === 'number' ? token.metadata.priceUSD : undefined;
        const dec = typeof token?.metadata?.decimals === 'number' ? token.metadata.decimals : 0;
        let humanAmount = undefined;
        if (typeof a?.eligibleAmount === 'number') {
          const raw = a.eligibleAmount;
          // heuristic: if raw is larger than 10^decimals / 100 (i.e. likely raw minimal units), convert
          const threshold = Math.pow(10, Math.min(dec, 6));
          if (raw >= threshold && dec > 0) {
            humanAmount = toHumanAmount(raw, dec);
          } else {
            humanAmount = raw; // assume it's already human
          }
        } else if (typeof a?.amount === 'number') {
          const raw = a.amount;
          const threshold = Math.pow(10, Math.min(dec, 6));
          if (raw >= threshold && dec > 0) {
            humanAmount = toHumanAmount(raw, dec);
          } else {
            humanAmount = raw;
          }
        }

        const usd = typeof price === 'number' && typeof humanAmount === 'number' && isFinite(humanAmount) ? humanAmount * price : undefined;
        return { ...a, usdValue: typeof usd === 'number' && isFinite(usd) ? usd : a.usdValue };
      } catch (e) {
        return a;
      }
    });
  } catch (err: any) {
    console.error('fetchAirdrops error', err);
    airdropError.value = err?.message ?? 'Airdrop fetch failed';
    airdrops.value = [];
  } finally {
    airdropLoading.value = false;
  }
}

function getAirdropIcon(a: any, kind: 'project' | 'token') {
  try {
    // prefer explicit project icon for project kind
    if (kind === 'project' && a?.project?.iconUrl) return a.project.iconUrl;
    // prefer token metadata if present
    if (kind === 'token' && a?.token?.metadata?.iconUrl) return a.token.metadata.iconUrl;
    // fallback: if token coinType exists, try to find it in tokensEnriched
    const ct = a?.token?.coinType || a?.token?.coin_type || null;
    if (ct) {
      const found = tokensEnriched.value.find((t: any) => String(t.coinType) === String(ct) || String(t.coinType).includes(String(ct)));
      if (found && found.iconUrl) return found.iconUrl;
    }
    // lastly, fall back to project icon if available
    if (a?.project?.iconUrl) return a.project.iconUrl;
    return null;
  } catch {
    return null;
  }
}

// claimAirdrop removed (no action column) and airdrops are loaded on main onMounted
</script>
