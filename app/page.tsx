"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Tabs, Tab } from "@heroui/tabs";
import { addToast } from "@heroui/toast";
import { Loader2, Plus, Play, StopCircle, DollarSign, Wallet, BarChart2 } from "lucide-react";
import { RadioGroup, Radio } from "@heroui/radio";
import { Progress } from "@heroui/progress";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";

import { ThemeSwitch } from "@/components/theme-switch";
import clientApiService, { ActiveBot } from "@/services/client-api-service";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { ethers } from "ethers";
import { NFTPositionManagerABI } from "@/constants/abis";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface Token {
  label: string;
  value: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
}

interface TickData {
  bot_id: string;
  x: number; // Time in seconds
  y: number; // Normalized tick (0 to 1)
  tick: number; // Actual tick value
  lower_tick: number;
  down_rbal: number;
  up_rebal: number;
  upper_tick: number;
  owed0_units: string;
  owed1_units: string;
  timestamp: string;
  status: string; // New
  position_id: number | null; // New
}

const WETHIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="1em"
    role="presentation"
    viewBox="0 0 24 24"
    width="1em"
    {...props}
  >
    <path
      d="M12 2L3 9v12h18V9l-9-7zm0 2.83l6.5 5V18h-13v-8.17L12 4.83z"
      fill="currentColor"
    />
  </svg>
);

const USDCIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="1em"
    role="presentation"
    viewBox="0 0 24 24"
    width="1em"
    {...props}
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"
      fill="currentColor"
    />
  </svg>
);

const FACTORY_ADDRESS = "0x0227628f3F023bb0B980b67D528571c95c6DaC1c";

const FactoryABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const PoolABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

export default function BotDashboard() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isOpenWithdraw, onOpen: onOpenWithdraw, onClose: onCloseWithdraw } = useDisclosure();

  const [activeBots, setActiveBots] = useState<ActiveBot[]>([]);
  const [unactiveBots, setUnactiveBots] = useState<ActiveBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [buttonLoading, setButtonLoading] = useState<{ [key: string]: { stop?: boolean; resume?: boolean; withdraw?: boolean } }>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [token0, setToken0] = useState("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
  const [token1, setToken1] = useState("0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14");
  const [feeTier, setFeeTier] = useState("500");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [cooldownSec, setCooldownSec] = useState("300");
  const [minWidthSpacings, setMinWidthSpacings] = useState("0");
  const [minWidthPct, setMinWidthPct] = useState("0");
  const [exitBufferSpacings, setExitBufferSpacings] = useState("5");
  const [slipageBps, setSlipageBps] = useState("50");
  const [maxRebalancesPerDay, setMaxRebalancesPerDay] = useState("");
  const [maxRebalancesPerHour, setMaxRebalancesPerHour] = useState("");
  const [maxTurnoverToken0, setMaxTurnoverToken0] = useState("");
  const [maxTurnoverToken1, setMaxTurnoverToken1] = useState("");
  const [circuitMaxBaseFeeGwei, setCircuitMaxBaseFeeGwei] = useState("");
  const [circuitMovePct, setCircuitMovePct] = useState("");
  const [circuitTickJump, setCircuitTickJump] = useState("");
  const [botType, setBotType] = useState("MANUAL")
  const [atrPeriod, setAtrPeriod] = useState("14")
  const [forecastHorizon, setForecastHorizon] = useState("7")
  const [bandCoverage, setBandCoverage] = useState("0.90")
  const [volMul, setVolMul] = useState("0.90")
  const [upperBand, setUpperBand] = useState("20")
  const [lowerBand, setLowerBand] = useState("18")
  const [rebalUp, setRebalUp] = useState("20")
  const [rebalDown, setRebalDown] = useState("18")


  const [price, setPrice] = useState(0);
  const [lastEdited, setLastEdited] = useState<'amount0' | 'amount1' | null>(null);
  const [tickData, setTickData] = useState<{ [bot_id: string]: TickData[] }>({});
  const [latestBotData, setLatestBotData] = useState<{ [bot_id: string]: Partial<TickData> }>({});
  const wsRef = useRef<WebSocket | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: number }>({});

  const getBalance = async (native = false, address?: string) => {
    const response = await clientApiService.post<any>(`/bot/getBalance?tokenAddress=${native ? "0x0000000000000000000000000000000000000000" : address}`, {}, false, "no-cache")
      console.log("response.data.tokenBalance : ",response.data.tokenBalance)
            console.log("(response as any) : ",(response as any))

    if (response.data.tokenBalance) {
      console.log("response.data.tokenBalance : ",response.data.tokenBalance)
      return response.data.tokenBalance
    }
    else return 0
  }
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const ethBalance = await getBalance(true);
        const token0Balance = await getBalance(false, token0);
        const token1Balance = await getBalance(false, token1);

        setBalances({
          eth: ethBalance,
          [token0]: token0Balance,
          [token1]: token1Balance,
        });
      } catch (err) {
        console.error("Failed to fetch balances", err);
      }
    };

    fetchBalances();
  }, [token0, token1]);

  const tokens: Token[] = [
    { label: "USDC", value: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", icon: USDCIcon },
    { label: "WETH", value: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", icon: WETHIcon },
  ];

  const feeTiers = [
    { label: "0.01% fee tier", value: "100" },
    { label: "0.05% fee tier", value: "500" },
    { label: "0.15% fee tier", value: "1500" },
    { label: "0.3% fee tier", value: "3000" },
    { label: "1% fee tier", value: "10000" },
  ];

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_API_BASE_URL_WS}/ws/graph`);
    wsRef.current = ws;

    ws.onopen = () => console.log("WebSocket connected");
    ws.onmessage = (event) => {
      const data: TickData = JSON.parse(event.data);
      setLatestBotData((prev) => ({
        ...prev,
        [data.bot_id]: {
          status: data.status,
          position_id: data.position_id,
          owed0_units: data.owed0_units,
          owed1_units: data.owed1_units,
          lower_tick: data.lower_tick,
          upper_tick: data.upper_tick,
          tick: data.tick,
          timestamp: data.timestamp,
        },
      }));

      if (data.y !== undefined) {
        setTickData((prev) => ({
          ...prev,
          [data.bot_id]: [...(prev[data.bot_id] || []).slice(-50), data], // Keep last 50 points
        }));
      }
    };
    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = () => console.log("WebSocket closed");

    return () => {
      ws.close();
    };
  }, []);

  const fetchBots = async () => {
    setLoading(true);
    try {
      const activeRes = await clientApiService.getActiveBots();
      const unactiveRes = await clientApiService.getUnactiveBots();
      setActiveBots(activeRes.active_bots);
      setUnactiveBots(unactiveRes.unactive_bots);
    } catch (err) {
      // addToast({
      //   title: "Error",
      //   description: err instanceof Error ? err.message : "Failed to fetch bots",
      //   timeout: 5000,
      //   shouldShowTimeoutProgress: true,
      // });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const getPriceInToken0PerToken1 = async () => {
    const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/54de27f3c9a641c790c667b446514c13");
    const factory = new ethers.Contract(FACTORY_ADDRESS, FactoryABI, provider);
    const poolAddress = await factory.getPool(token0, token1, Number(feeTier));
    if (poolAddress === ethers.ZeroAddress) {
      throw new Error("Pool not found");
    }
    const pool = new ethers.Contract(poolAddress, PoolABI, provider);
    const slot0 = await pool.slot0();
    const sqrtPriceX96 = slot0[0]; // uint160
    const sqrtPrice = Number(sqrtPriceX96) / Math.pow(2, 96);
    const rawPriceNum = Math.pow(sqrtPrice, 2);
    const dec0 = 6;
    const dec1 = 18;
    const ph = Math.pow(10, dec1 - dec0) / rawPriceNum;
    return ph;
  };

  useEffect(() => {
    if (currentStep === 2 && price === 0) {
      const fetchPrice = async () => {
        try {
          const p = await getPriceInToken0PerToken1();
          setPrice(p);
        } catch (err) {
          addToast({
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to fetch price",
            timeout: 5000,
            shouldShowTimeoutProgress: true,
          });
        }
      };
      fetchPrice();
    }
  }, [currentStep, price]);

  useEffect(() => {
    if (lastEdited === 'amount0' && amount0 && price > 0) {
      const amt0 = parseFloat(amount0);
      if (!isNaN(amt0)) {
        setAmount1((amt0 / price).toFixed(6));
      }
    }
  }, [amount0, lastEdited, price]);

  useEffect(() => {
    if (lastEdited === 'amount1' && amount1 && price > 0) {
      const amt1 = parseFloat(amount1);
      if (!isNaN(amt1)) {
        setAmount0((amt1 * price).toFixed(2));
      }
    }
  }, [amount1, lastEdited, price]);

  const handleStartBot = async () => {
    setLoading(true);
    try {
      const payload = {
        token0_address: token0,
        token1_address: token1,
        token0_amount: parseFloat(amount0),
        token1_amount: parseFloat(amount1),
        POOL_FEE: parseInt(feeTier),
        COOLDOWN_SEC: Number(cooldownSec),
        MIN_WIDTH_SPACINGS: Number(minWidthSpacings),
        MIN_WIDTH_PCT: Number(minWidthPct),
        EXIT_BUFFER_SPACINGS: Number(exitBufferSpacings),
        slipage_bps: Number(slipageBps),
        max_rebalances_per_day: maxRebalancesPerDay ? Number(maxRebalancesPerDay) : undefined,
        max_rebalances_per_hour: maxRebalancesPerHour ? Number(maxRebalancesPerHour) : undefined,
        max_turnover_token0_24h: maxTurnoverToken0 ? Number(maxTurnoverToken0) : undefined,
        max_turnover_token1_24h: maxTurnoverToken1 ? Number(maxTurnoverToken1) : undefined,
        circuit_max_base_fee_gwei: circuitMaxBaseFeeGwei ? Number(circuitMaxBaseFeeGwei) : undefined,
        circuit_move_pct: circuitMovePct ? Number(circuitMovePct) : undefined,
        circuit_tick_jump: circuitTickJump ? Number(circuitTickJump) : undefined,
        bot_type: botType || "MAN",
        manual_upper_band: upperBand ? Number(upperBand) : undefined,
        manual_lower_band_pct: lowerBand ? Number(lowerBand) : undefined,
        VOL_MULT: volMul ? Number(volMul) : 1.0,
        P_TARGET: bandCoverage ? Number(bandCoverage) : 1.0,
        ATR_PERIOD_DAYS: atrPeriod ? Number(atrPeriod) : 7,
        HORIZON_DAYS: forecastHorizon ? Number(forecastHorizon) : 7,
        SIGMA_FACTOR: bandCoverage ? Number(bandCoverage) : 1.0,
        downside_rebal_pct: rebalDown ? Number(rebalDown) : undefined,
        upside_rebal_pct: rebalUp ? Number(rebalUp) : undefined,
      };

      const response = await clientApiService.startBot(payload);
      addToast({
        title: "Success",
        description: `Bot started successfully with ID: ${response.bot_id}`,
        timeout: 5000,
        shouldShowTimeoutProgress: true,
        endContent: (
          <Button size="sm" variant="flat" onPress={() => fetchBots()}>
            Refresh
          </Button>
        ),
      });
      onClose();
      setCurrentStep(1);
      setAmount0("");
      setAmount1("");
      setCooldownSec("300");
      setMinWidthSpacings("0");
      setMinWidthPct("0");
      setExitBufferSpacings("5");
      setSlipageBps("50");
      setMaxRebalancesPerDay("10");
      setMaxRebalancesPerHour("2");
      setMaxTurnoverToken0("");
      setMaxTurnoverToken1("");
      setCircuitMaxBaseFeeGwei("9000");
      setCircuitMovePct("20");
      setCircuitTickJump("900");

      setPrice(0);
      setLastEdited(null);
      fetchBots();
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to start bot",
        timeout: 5000,
        shouldShowTimeoutProgress: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStopBot = async (botId: string) => {
    setButtonLoading((prev) => ({ ...prev, [botId]: { ...prev[botId], stop: true } }));
    try {
      await clientApiService.stopBot(botId);
      addToast({
        title: "Success",
        description: `Bot ${botId.slice(0, 8)}... stopped successfully`,
        timeout: 5000,
        shouldShowTimeoutProgress: true,
        endContent: (
          <Button size="sm" variant="flat" onPress={() => fetchBots()}>
            Refresh
          </Button>
        ),
      });
      fetchBots();
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to stop bot",
        timeout: 5000,
        shouldShowTimeoutProgress: true,
      });
    } finally {
      setButtonLoading((prev) => ({ ...prev, [botId]: { ...prev[botId], stop: false } }));
    }
  };

  const handleResumeBot = async (botId: string) => {
    setButtonLoading((prev) => ({ ...prev, [botId]: { ...prev[botId], resume: true } }));
    try {
      await clientApiService.resumeBot(botId);
      addToast({
        title: "Success",
        description: `Bot ${botId.slice(0, 8)}... resumed successfully`,
        timeout: 5000,
        shouldShowTimeoutProgress: true,
        endContent: (
          <Button size="sm" variant="flat" onPress={() => fetchBots()}>
            Refresh
          </Button>
        ),
      });
      fetchBots();
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to resume bot",
        timeout: 5000,
        shouldShowTimeoutProgress: true,
      });
    } finally {
      setButtonLoading((prev) => ({ ...prev, [botId]: { ...prev[botId], resume: false } }));
    }
  };

  const handleWithdrawBot = async (botId: string) => {
    setButtonLoading((prev) => ({ ...prev, [botId]: { ...prev[botId], withdraw: true } }));
    try {
      await clientApiService.withdrawLiquidity(botId);
      addToast({
        title: "Success",
        description: `Liquidity withdrawn for bot ${botId.slice(0, 8)}...`,
        timeout: 5000,
        shouldShowTimeoutProgress: true,
        endContent: (
          <Button size="sm" variant="flat" onPress={() => fetchBots()}>
            Refresh
          </Button>
        ),
      });
      fetchBots();
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to withdraw",
        timeout: 5000,
        shouldShowTimeoutProgress: true,
      });
    } finally {
      setButtonLoading((prev) => ({ ...prev, [botId]: { ...prev[botId], withdraw: false } }));
    }
  };
  
  const getStatusColor = (status: string) => {
    if (status.includes('active')) return 'success';
    if (status.includes('rebalancing') || status.includes('minting') || status.includes('withdrawing')) return 'warning';
    if (status.includes('error')) return 'danger';
    if (status.includes('stopped') || status.includes('withdrawn')) return 'default';
    return 'primary';
  };

  const BotCard = ({ bot, isActive }: { bot: ActiveBot; isActive: boolean }) => {
    const getIsDiabled=(status: string)=>{
    if ( status.includes('withdrawn')) return true
  }
    const token0Info = tokens.find((t) => t.value === bot.token0_address);
    const token1Info = tokens.find((t) => t.value === bot.token1_address);
    const token0Label = token0Info?.label || bot.token0_address.slice(0, 6);
    const token1Label = token1Info?.label || bot.token1_address.slice(0, 6);
    const Token0Icon = token0Info?.icon || WETHIcon;
    const Token1Icon = token1Info?.icon || USDCIcon;
    const chartRef = useRef<any>(null);

    const latest = latestBotData[bot.bot_id] || {};
    const currentStatus = latest.status || bot.status;
    const currentPositionId = latest.position_id ?? bot.position_id;
    const owed0 = latest.owed0_units || (tickData[bot.bot_id]?.at(-1)?.owed0_units || '0');
    const owed1 = latest.owed1_units || (tickData[bot.bot_id]?.at(-1)?.owed1_units || '0');
    const isProcessing = currentStatus.includes('rebalancing') || currentStatus.includes('minting') || currentStatus.includes('withdrawing');
    const ticks = tickData[bot.bot_id]?.map((d) => d.tick) || [];
    const lowerTicks = tickData[bot.bot_id]?.map((d) => d.lower_tick) || [];
    const upperRebal = tickData[bot.bot_id]?.map((d) => d.up_rebal) || [];
    const downRebal = tickData[bot.bot_id]?.map((d) => d.down_rbal) || [];


    const upperTicks = tickData[bot.bot_id]?.map((d) => d.upper_tick) || [];
    const allTicks = [...ticks, ...lowerTicks, ...upperTicks, ...upperRebal, ...downRebal];
    const minTick = allTicks.length > 0 ? Math.min(...allTicks) : 0;
    const maxTick = allTicks.length > 0 ? Math.max(...allTicks) : 0;

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          display: false,
        },
        y: {
          title: { display: false },
          grid: { display: false },
          ticks: { display: false },
          min: minTick - 500,
          max: maxTick + 500,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: 'index' as const,
          intersect: false,
        },
      },
      elements: {
        line: {
          tension: 0.4,
        },
        point: {
          radius: 0,
        },
      },
    };

    const initialChartData = {
      labels: tickData[bot.bot_id]?.map((d) => '') || [], // Empty labels for time
      datasets: [
        {
          label: "Current Tick",
          data: tickData[bot.bot_id]?.map((d) => d.tick) || [],
          borderColor: "#818cf8",
          backgroundColor: (ctx: any) => {
            const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
            gradient.addColorStop(0, "rgba(129, 140, 248, 0.4)");
            gradient.addColorStop(1, "rgba(129, 140, 248, 0)");
            return gradient;
          },
          fill: true,
        },
        {
          label: "Upper Tick",
          data: tickData[bot.bot_id]?.map((d) => d.upper_tick) || [],
          borderColor: "#34d399",
          borderDash: [4, 4],
          fill: false,
        },
        {
          label: "Lower Tick",
          data: tickData[bot.bot_id]?.map((d) => d.lower_tick) || [],
          borderColor: "#34d399",
          borderDash: [4, 4],
          fill: false,
        },
        {
          label: "Upper Rebal",
          data: tickData[bot.bot_id]?.map((d) => d.up_rebal) || [],
          borderColor: "#a78bfa",
          borderDash: [2, 2],
          fill: false,
        },
        {
          label: "Lower Rebal",
          data: tickData[bot.bot_id]?.map((d) => d.down_rbal) || [],
          borderColor: "#a78bfa",
          borderDash: [2, 2],
          fill: false,
        },
      ],
    };

    useEffect(() => {
      if (!chartRef.current) return;
      const chart = chartRef.current;

      const labels = tickData[bot.bot_id]?.map((d) => '') || [];
      const currentTicks = tickData[bot.bot_id]?.map((d) => d.tick) || [];
      const lowerTicks = tickData[bot.bot_id]?.map((d) => d.lower_tick) || [];
      const upperTicks = tickData[bot.bot_id]?.map((d) => d.upper_tick) || [];
      const upperRebal = tickData[bot.bot_id]?.map((d) => d.up_rebal) || [];
      const lowerRebal = tickData[bot.bot_id]?.map((d) => d.down_rbal) || [];



      chart.data.labels = labels;
      chart.data.datasets[0].data = currentTicks;
      chart.data.datasets[1].data = upperTicks;
      chart.data.datasets[2].data = lowerTicks;
      chart.data.datasets[3].data = upperRebal;
      chart.data.datasets[4].data = lowerRebal;

      chart.update("none"); // 'none' prevents animation for smooth tick movement
    }, [tickData[bot.bot_id]]);

    return (
      <Card className="overflow-hidden rounded-2xl shadow-xl border-0 bg-white dark:bg-gray-800 transition-all hover:scale-105 hover:shadow-2xl">
        <CardHeader className="flex justify-between items-start p-6 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
          <div>
            <h3 className="text-lg font-bold">Bot {bot.bot_id.slice(0, 8)}</h3>
            <p className="text-sm opacity-80">Position #{currentPositionId ?? 'N/A'}</p>
          </div>
          <Chip color={getStatusColor(currentStatus)} variant="shadow" size="sm" startContent={isProcessing ? <Loader2 className="animate-spin" size={14} /> : null}>
            {currentStatus.toUpperCase()}
          </Chip>
        </CardHeader>
        <CardBody className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Avatar src="/usd-coin-usdc-logo.png" className="bg-indigo-100 dark:bg-indigo-900"/>
              
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{token0Label}</p>
                <p className="font-bold">{Number(bot.token0_amount).toFixed(3)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Avatar src="/ethereum-eth-logo.png" className="bg-indigo-100 dark:bg-indigo-900"/>
                
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{token1Label}</p>
                <p className="font-bold">{Number(bot.token1_amount).toFixed(3)}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Fee Tier</span>
            <span className="font-medium">{bot.POOL_FEE / 10000}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Earned Fees</span>
            <span className="font-medium">
              {Number(owed0).toFixed(6)} {token0Label} / {Number(owed1).toFixed(6)} {token1Label}
            </span>
          </div>
          {isActive && tickData[bot.bot_id]?.length > 0 && (
            <div className="h-40 bg-gray-50 dark:bg-gray-900 rounded-xl p-2">
              <Line ref={chartRef} data={initialChartData} options={chartOptions} />
            </div>
          )}
        </CardBody>
        <CardFooter className="p-6 flex justify-end space-x-3 bg-gray-50 dark:bg-gray-900">
          {isActive ? (
            <Button
              color="danger"
              variant="flat"
              onPress={() => handleStopBot(bot.bot_id)}
              isLoading={buttonLoading[bot.bot_id]?.stop}
              startContent={!buttonLoading[bot.bot_id]?.stop && <StopCircle size={16} />}
            >
              Stop
            </Button>
          ) : (
            <>
              <Button
                color="success"
                variant="flat"
                isDisabled={getIsDiabled(bot.status)}
                onPress={() => handleResumeBot(bot.bot_id)}
                isLoading={buttonLoading[bot.bot_id]?.resume}
                startContent={!buttonLoading[bot.bot_id]?.resume && <Play size={16} />}
              >
                Resume
              </Button>
              <Button
                color="primary"
                variant="flat"
                isDisabled={getIsDiabled(bot.status)}
                onPress={() => handleWithdrawBot(bot.bot_id)}
                isLoading={buttonLoading[bot.bot_id]?.withdraw}
                startContent={!buttonLoading[bot.bot_id]?.withdraw && <DollarSign size={16} />}
              >
                Withdraw
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    );
  };

  const withdrawLiquidityManual = async () => {
    try {
      setIsLoadingWithdraw(true)
      const response = await clientApiService.post<any>(`/bot/withdraw-manual?position_id=${positionId}`, {}, false, "no-cache")
      if (response) {
        addToast({
          title: "Success",
          description: `${response}`,
          timeout: 5000,
          shouldShowTimeoutProgress: true,
        });
        onCloseWithdraw()
      }

    }
    catch (e) {
      console.log(e)
    }
    setIsLoadingWithdraw(false)
  }

  const [positionId, setPositionId] = useState("")
  const [isLoadingWithdraw, setIsLoadingWithdraw] = useState(false)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            Liquidity Bot Control Center
          </h1>
          <ThemeSwitch />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 flex items-center space-x-4">
            <Avatar className="bg-indigo-100 dark:bg-indigo-900">
              <Wallet className="text-indigo-500" size={20} />
            </Avatar>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">ETH Balance</p>
              <p className="font-bold text-lg">{Number(balances.eth)?.toFixed(4) ?? "0.00"}</p>
            </div>
          </Card>
          <div className="flex flex-col justify-between ">
<Button
            color="primary"
            variant="shadow"
            onPress={onOpen}
            className="rounded-2xl"
            startContent={<Plus size={20} />}
          >
            Deploy New Bot
          </Button>
          <Button
            color="secondary"
            variant="shadow"
            onPress={onOpenWithdraw}
            className="rounded-2xl"
            startContent={<DollarSign size={20} />}
          >
            Manual Withdraw
          </Button>
          </div>
          
        </div>
        <Modal isOpen={isOpenWithdraw} onClose={onCloseWithdraw} size="md" backdrop="blur">
          <ModalContent>
            <ModalHeader className="text-2xl font-bold">Manual Liquidity Withdrawal</ModalHeader>
            <ModalBody>
              <Input
                label="Position ID"
                placeholder="Enter position ID"
                type="number"
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                variant="bordered"
                description="Withdraw liquidity from a specific position"
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onCloseWithdraw}>Cancel</Button>
              <Button color="danger" isLoading={isLoadingWithdraw} onPress={withdrawLiquidityManual}>Withdraw</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={isOpen} onClose={onClose} size="xl" backdrop="blur" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader className="text-2xl font-bold">Deploy New Bot</ModalHeader>
            <Progress value={(currentStep / 4) * 100} color="primary" className="px-6 mb-4" showValueLabel={true} />
            <ModalBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentStep === 1 && (
                <>
                  <Card className="p-4">
                    <Select
                      label="Token Pair"
                      description="Select base token pair"
                      selectedKeys={[token0, token1]}
                      isDisabled
                      variant="bordered"
                    >
                      {tokens.map((t) => (
                        <SelectItem key={t.value} startContent={<t.icon className="text-lg" />}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </Select>
                    <Select
                      label="Fee Tier"
                      description="Select pool fee tier"
                      selectedKeys={[feeTier]}
                      onSelectionChange={(keys) => setFeeTier(Array.from(keys)[0] as string)}
                      variant="bordered"
                      className="mt-4"
                    >
                      {feeTiers.map((f) => (
                        <SelectItem key={f.value}>{f.label}</SelectItem>
                      ))}
                    </Select>
                  </Card>
                  <Card className="p-4 bg-indigo-50 dark:bg-indigo-900/20">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Configure your bot's base parameters. Choose the token pair and fee tier to optimize for your strategy.</p>
                  </Card>
                </>
              )}
              {currentStep === 2 && (
                <>
                  <Card className="p-4">
                    <Input
                      label={`${tokens.find((t) => t.value === token0)?.label} Amount`}
                      type="number"
                      value={amount0}
                      onChange={(e) => {
                        setAmount0(e.target.value);
                        setLastEdited('amount0');
                      }}
                      endContent={<span className="text-sm text-gray-500">Bal: {Number(balances[token0])?.toFixed(4)}</span>}
                      variant="bordered"
                    />
                    <Input
                      label={`${tokens.find((t) => t.value === token1)?.label} Amount`}
                      type="number"
                      value={amount1}
                      onChange={(e) => {
                        setAmount1(e.target.value);
                        setLastEdited('amount1');
                      }}
                      endContent={<span className="text-sm text-gray-500">Bal: {Number(balances[token1])?.toFixed(4)}</span>}
                      variant="bordered"
                      className="mt-4"
                    />
                  </Card>
                  <Card className="p-4 bg-indigo-50 dark:bg-indigo-900/20">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Specify the amounts for liquidity provision. Amounts are auto-adjusted based on current price.</p>
                  </Card>
                </>
              )}
              {currentStep === 3 && (
                <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Cooldown (sec)"
                    type="number"
                    value={cooldownSec}
                    onChange={(e) => setCooldownSec(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Min Width Spacings"
                    type="number"
                    value={minWidthSpacings}
                    onChange={(e) => setMinWidthSpacings(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Min Width %"
                    type="number"
                    value={minWidthPct}
                    onChange={(e) => setMinWidthPct(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Exit Buffer Spacings"
                    type="number"
                    value={exitBufferSpacings}
                    onChange={(e) => setExitBufferSpacings(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Slippage BPS"
                    type="number"
                    value={slipageBps}
                    onChange={(e) => setSlipageBps(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Max Rebal/Day"
                    type="number"
                    value={maxRebalancesPerDay}
                    onChange={(e) => setMaxRebalancesPerDay(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Max Rebal/Hour"
                    type="number"
                    value={maxRebalancesPerHour}
                    onChange={(e) => setMaxRebalancesPerHour(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Max Turnover T0"
                    type="number"
                    value={maxTurnoverToken0}
                    onChange={(e) => setMaxTurnoverToken0(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Max Turnover T1"
                    type="number"
                    value={maxTurnoverToken1}
                    onChange={(e) => setMaxTurnoverToken1(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Circuit Max Fee (gwei)"
                    type="number"
                    value={circuitMaxBaseFeeGwei}
                    onChange={(e) => setCircuitMaxBaseFeeGwei(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Circuit Move %"
                    type="number"
                    value={circuitMovePct}
                    onChange={(e) => setCircuitMovePct(e.target.value)}
                    variant="bordered"
                  />
                  <Input
                    label="Circuit Tick Jump"
                    type="number"
                    value={circuitTickJump}
                    onChange={(e) => setCircuitTickJump(e.target.value)}
                    variant="bordered"
                  />
                </div>
              )}
              {currentStep === 4 && (
                <>
                  <Card className="p-4">
                    <RadioGroup label="Bot Type" value={botType} onValueChange={setBotType}>
                      <Radio value="MANUAL">Manual</Radio>
                      <Radio value="LRPF">LRPF</Radio>
                    </RadioGroup>
                    <div className="mt-4 space-y-4">
                      <Input
                        label="Upside Rebal %"
                        type="number"
                        value={rebalUp}
                        onChange={(e) => setRebalUp(e.target.value)}
                        variant="bordered"
                      />
                      <Input
                        label="Downside Rebal %"
                        type="number"
                        value={rebalDown}
                        onChange={(e) => setRebalDown(e.target.value)}
                        variant="bordered"
                      />
                    </div>
                  </Card>
                  <Card className="p-4">
                    {botType === "MANUAL" ? (
                      <div className="space-y-4">
                        <Input
                          label="Upper Band %"
                          type="number"
                          value={upperBand}
                          onChange={(e) => setUpperBand(e.target.value)}
                          variant="bordered"
                        />
                        <Input
                          label="Lower Band %"
                          type="number"
                          value={lowerBand}
                          onChange={(e) => setLowerBand(e.target.value)}
                          variant="bordered"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Input
                          label="ATR Period"
                          type="number"
                          value={atrPeriod}
                          onChange={(e) => setAtrPeriod(e.target.value)}
                          variant="bordered"
                        />
                        <Input
                          label="Forecast Horizon"
                          type="number"
                          value={forecastHorizon}
                          onChange={(e) => setForecastHorizon(e.target.value)}
                          variant="bordered"
                        />
                        <Input
                          label="P Target"
                          type="number"
                          value={bandCoverage}
                          onChange={(e) => setBandCoverage(e.target.value)}
                          variant="bordered"
                        />
                        <Input
                          label="Vol Multiplier"
                          type="number"
                          value={volMul}
                          onChange={(e) => setVolMul(e.target.value)}
                          variant="bordered"
                        />
                      </div>
                    )}
                  </Card>
                </>
              )}
            </ModalBody>
            <ModalFooter className="flex justify-between">
              {currentStep > 1 && (
                <Button variant="flat" onPress={() => setCurrentStep(currentStep - 1)}>Previous</Button>
              )}
              {currentStep < 4 ? (
                <Button color="primary" onPress={() => setCurrentStep(currentStep + 1)}>Next Step</Button>
              ) : (
                <Button color="primary" isLoading={loading} onPress={handleStartBot}>Deploy Bot</Button>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-indigo-500 size-12" />
          </div>
        ) : (
          <Tabs variant="bordered" color="primary" classNames={{ panel: "pt-6" }}>
            <Tab key="active" title={
              <div className="flex items-center space-x-2">
                <BarChart2 size={16} />
                <span>Active Bots</span>
              </div>
            }>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeBots.map((bot) => <BotCard key={bot.bot_id} bot={bot} isActive={true} />)}
                {activeBots.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 col-span-3">No active bots deployed yet</p>}
              </div>
            </Tab>
            <Tab key="inactive" title="Inactive Bots">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unactiveBots.map((bot) => <BotCard key={bot.bot_id} bot={bot} isActive={false} />)}
                {unactiveBots.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 col-span-3">No inactive bots</p>}
              </div>
            </Tab>
          </Tabs>
        )}
      </div>
    </div>
  );
}