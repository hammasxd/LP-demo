"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Tabs, Tab } from "@heroui/tabs";
import { addToast } from "@heroui/toast";
import { Loader2, Plus, Play, StopCircle, DollarSign } from "lucide-react";
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
  const [cooldownSec, setCooldownSec] = useState("3600");
  const [minWidthSpacings, setMinWidthSpacings] = useState("10");
  const [minWidthPct, setMinWidthPct] = useState("0.05");
  const [exitBufferSpacings, setExitBufferSpacings] = useState("5");
  const [slipageBps, setSlipageBps] = useState("50");
  const [maxRebalancesPerDay, setMaxRebalancesPerDay] = useState("");
  const [maxRebalancesPerHour, setMaxRebalancesPerHour] = useState("");
  const [maxTurnoverToken0, setMaxTurnoverToken0] = useState("");
  const [maxTurnoverToken1, setMaxTurnoverToken1] = useState("");
  const [circuitMaxBaseFeeGwei, setCircuitMaxBaseFeeGwei] = useState("");
const [circuitMovePct, setCircuitMovePct] = useState("");
const [circuitTickJump, setCircuitTickJump] = useState("");

  const [price, setPrice] = useState(0);
  const [lastEdited, setLastEdited] = useState<'amount0' | 'amount1' | null>(null);
  const [tickData, setTickData] = useState<{ [bot_id: string]: TickData[] }>({});
  const [latestBotData, setLatestBotData] = useState<{ [bot_id: string]: Partial<TickData> }>({});
  const wsRef = useRef<WebSocket | null>(null);

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
    const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/09d83155055445d08c5e7becc22e18e3");
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
  max_rebalances_per_day: maxRebalancesPerDay ? Number(maxRebalancesPerDay) : null,
  max_rebalances_per_hour: maxRebalancesPerHour ? Number(maxRebalancesPerHour) : null,
  max_turnover_token0_24h: maxTurnoverToken0 ? Number(maxTurnoverToken0) : null,
  max_turnover_token1_24h: maxTurnoverToken1 ? Number(maxTurnoverToken1) : null,
  circuit_max_base_fee_gwei: circuitMaxBaseFeeGwei ? Number(circuitMaxBaseFeeGwei) : null,
  circuit_move_pct: circuitMovePct ? Number(circuitMovePct) : null,
  circuit_tick_jump: circuitTickJump ? Number(circuitTickJump) : null,
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
      setCooldownSec("3600");
      setMinWidthSpacings("10");
      setMinWidthPct("0.05");
      setExitBufferSpacings("5");
      setSlipageBps("50");
      setMaxRebalancesPerDay("");
      setMaxRebalancesPerHour("");
      setMaxTurnoverToken0("");
      setMaxTurnoverToken1("");
      setCircuitMaxBaseFeeGwei("");
setCircuitMovePct("");
setCircuitTickJump("");

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
    if (status.includes('active')) return 'bg-green-500/20 text-green-400';
    if (status.includes('rebalancing') || status.includes('minting') || status.includes('withdrawing')) return 'bg-yellow-500/20 text-yellow-400';
    if (status.includes('error')) return 'bg-red-500/20 text-red-400';
    if (status.includes('stopped') || status.includes('withdrawn')) return 'bg-gray-500/20 text-gray-400';
    return 'bg-blue-500/20 text-blue-400';
  };

  const BotCard = ({ bot, isActive }: { bot: ActiveBot; isActive: boolean }) => {
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
  const upperTicks = tickData[bot.bot_id]?.map((d) => d.upper_tick) || [];
  const allTicks = [...ticks, ...lowerTicks, ...upperTicks];
  const minTick = allTicks.length > 0 ? Math.min(...allTicks) : 0;
  const maxTick = allTicks.length > 0 ? Math.max(...allTicks) : 0;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        title: { display: true, text: "Tick", color: "#d1d5db" },
        grid: { color: "rgba(209, 213, 219, 0.1)" },
        ticks: { color: "#d1d5db" },
        min: minTick - 100, // Extend lower boundary by 300 ticks
        max: maxTick + 100, // Extend upper boundary by 300 ticks
      },
    },
    plugins: {
      legend: { display: true, position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw.toFixed(0)}`,
        },
      },
    },
  };  

    const initialChartData = {
      labels: tickData[bot.bot_id]?.map((d) => '') || [], // Empty labels for time
      datasets: [
        {
          label: "Current Tick",
          data: tickData[bot.bot_id]?.map((d) => d.tick) || [],
          borderColor: "#3b82f6",
          backgroundColor: (ctx: any) => {
            const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 150);
            gradient.addColorStop(0, "rgba(59, 130, 246, 0.4)");
            gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointBackgroundColor: "#3b82f6",
        },
        {
          label: "Lower Tick",
          data: tickData[bot.bot_id]?.map((d) => d.lower_tick) || [],
          borderColor: "#ef4444",
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
        {
          label: "Upper Tick",
          data: tickData[bot.bot_id]?.map((d) => d.upper_tick) || [],
          borderColor: "#22c55e",
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
      ],
    };

    // Efficiently update chart data when new ticks arrive
    useEffect(() => {
      if (!chartRef.current) return;
      const chart = chartRef.current;

      const labels = tickData[bot.bot_id]?.map((d) => '') || [];
      const currentTicks = tickData[bot.bot_id]?.map((d) => d.tick) || [];
      const lowerTicks = tickData[bot.bot_id]?.map((d) => d.lower_tick) || [];
      const upperTicks = tickData[bot.bot_id]?.map((d) => d.upper_tick) || [];

      chart.data.labels = labels;
      chart.data.datasets[0].data = currentTicks;
      chart.data.datasets[1].data = lowerTicks;
      chart.data.datasets[2].data = upperTicks;
      chart.update("none"); // 'none' prevents animation for smooth tick movement
    }, [tickData[bot.bot_id]]);

    return (
      <Card  className="">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="text-lg font-bold">Bot ID: {bot.bot_id.slice(0, 8)}...</div>
            <span className={`text-sm px-2 py-1 rounded-full ${getStatusColor(currentStatus)}`}>
              {isProcessing ? <Loader2 className="inline mr-1 animate-spin" size={14} /> : null}
              {currentStatus}
            </span>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold">Position ID:</span>
            <span>{currentPositionId ?? 'None'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Token0Icon className="text-xl text-blue-400" />
            <span className="text-sm font-semibold">{token0Label}:</span>
            <span>{Number(bot.token0_amount).toFixed(3)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Token1Icon className="text-xl text-blue-400" />
            <span className="text-sm font-semibold">{token1Label}:</span>
            <span>{Number(bot.token1_amount).toFixed(3)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold">Fee Tier:</span>
            <span>{bot.POOL_FEE / 10000}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold">Earned Fees:</span>
            <span>
              {Number(owed0).toFixed(6)} {token0Label},{" "}
              {Number(owed1).toFixed(6)} {token1Label}
            </span>
          </div>

          {isActive && tickData[bot.bot_id]?.length > 0 && (
            <div className="h-40">
              <Line ref={chartRef} data={initialChartData} options={chartOptions} />
            </div>
          )}
        </CardBody>

        <CardFooter className="flex justify-end space-x-2">
          {isActive ? (
            <Button
              size="sm"
              onPress={() => handleStopBot(bot.bot_id)}
              isLoading={buttonLoading[bot.bot_id]?.stop}
              color="danger"
            >
              {!buttonLoading[bot.bot_id]?.stop && <StopCircle className="mr-1" />}
              Stop
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onPress={() => handleResumeBot(bot.bot_id)}
                isLoading={buttonLoading[bot.bot_id]?.resume}
                color="success"
              >
                {!buttonLoading[bot.bot_id]?.resume && <Play className="mr-1" />}
                Resume
              </Button>
              <Button
                size="sm"
                onPress={() => handleWithdrawBot(bot.bot_id)}
                isLoading={buttonLoading[bot.bot_id]?.withdraw}
                color="primary"
              >
                {!buttonLoading[bot.bot_id]?.withdraw && <DollarSign className="mr-1" />}
                Withdraw
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    );
  };


  return (
    <div>
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold  ">Liquidity Bot Dashboard</h1>
          <ThemeSwitch />
        </div>

        <Button
          onPress={onOpen}
          className="mb-8"
        >
          <Plus className="mr-2" /> Add New Bot
        </Button>

        <Modal
          backdrop="blur"
          scrollBehavior="inside"
          isOpen={isOpen}
          onClose={() => {
            onClose();
            setCurrentStep(1);
            setAmount0("");
            setAmount1("");
            setCooldownSec("3600");
            setMinWidthSpacings("10");
            setMinWidthPct("0.05");
            setExitBufferSpacings("5");
            setSlipageBps("50");
            setMaxRebalancesPerDay("");
            setMaxRebalancesPerHour("");
            setMaxTurnoverToken0("");
            setMaxTurnoverToken1("");
            setPrice(0);
            setLastEdited(null);
          }}
          className=""
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className=" text-2xl font-bold">Add New Liquidity Bot</ModalHeader>
                <ModalBody className="space-y-4">
                  {currentStep === 1 && (
                    <>
                      <Select
                        label="Token 0"
                        description="Select the first token for the liquidity pair"
                        selectedKeys={[token0]}
                        isDisabled
                        onSelectionChange={(keys) => setToken0(Array.from(keys)[0] as string)}
                        startContent={<div className="flex items-center">{tokens.find(t => t.value === token0)?.icon({ className: "text-xl" })}</div>}
                      >
                        {tokens.map((t) => (
                          <SelectItem key={t.value} startContent={<t.icon className="text-xl" />}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </Select>
                      <Select
                        label="Token 1"
                        description="Select the second token for the liquidity pair"
                        selectedKeys={[token1]}
                        isDisabled
                        onSelectionChange={(keys) => setToken1(Array.from(keys)[0] as string)}
                        startContent={<div className="flex items-center">{tokens.find(t => t.value === token1)?.icon({ className: "text-xl " })}</div>}
                      >
                        {tokens.map((t) => (
                          <SelectItem key={t.value} startContent={<t.icon className="text-xl " />}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </Select>
                      <Select
                        label="Fee Tier"
                        description="Choose the fee tier that suits your strategy"
                        selectedKeys={[feeTier]}
                        onSelectionChange={(keys) => setFeeTier(Array.from(keys)[0] as string)}
                      >
                        {feeTiers.map((f) => (
                          <SelectItem key={f.value}>{f.label}</SelectItem>
                        ))}
                      </Select>
                    </>
                  )}
                  {currentStep === 2 && (
                    <>
                      <Input
                        label={`Amount of ${tokens.find((t) => t.value === token0)?.label}`}
                        description={`Enter the amount of ${tokens.find((t) => t.value === token0)?.label} to provide`}
                        type="number"
                        value={amount0}
                        onChange={(e) => {
                          setAmount0(e.target.value);
                          setLastEdited('amount0');
                        }}
                        endContent={<span className="text-default-400 text-small">{tokens.find((t) => t.value === token0)?.label}</span>}
                        placeholder="0.00"
                      />
                      <Input
                        label={`Amount of ${tokens.find((t) => t.value === token1)?.label}`}
                        description={`Enter the amount of ${tokens.find((t) => t.value === token1)?.label} to provide`}
                        type="number"
                        value={amount1}
                        onChange={(e) => {
                          setAmount1(e.target.value);
                          setLastEdited('amount1');
                        }}
                        endContent={<span className="text-default-400 text-small">{tokens.find((t) => t.value === token1)?.label}</span>}
                        placeholder="0.00"
                      />
                    </>
                  )}
                  {currentStep === 3 && (
                    <>
                      <Input
                        label="Cooldown Seconds"
                        description="Minimum time in seconds between rebalances."
                        type="number"
                        value={cooldownSec}
                        onChange={(e) => setCooldownSec(e.target.value)}
                        placeholder="3600"
                      />
                      <Input
                        label="Min Width Spacings"
                        description="Minimum width of the liquidity range in tick spacings."
                        type="number"
                        value={minWidthSpacings}
                        onChange={(e) => setMinWidthSpacings(e.target.value)}
                        placeholder="10"
                      />
                      <Input
                        label="Min Width Percentage"
                        description="Minimum width of the liquidity range as a percentage."
                        type="number"
                        step="0.01"
                        value={minWidthPct}
                        onChange={(e) => setMinWidthPct(e.target.value)}
                        placeholder="0.05"
                      />
                      <Input
                        label="Exit Buffer Spacings"
                        description="Number of tick spacings for the exit buffer (hysteresis)."
                        type="number"
                        value={exitBufferSpacings}
                        onChange={(e) => setExitBufferSpacings(e.target.value)}
                        placeholder="5"
                      />
                      <Input
                        label="Slippage BPS"
                        description="Slippage tolerance in basis points for liquidity operations."
                        type="number"
                        value={slipageBps}
                        onChange={(e) => setSlipageBps(e.target.value)}
                        placeholder="50"
                      />
                      <Input
                        label="Max Rebalances Per Day"
                        description="Maximum number of rebalances allowed per day. Leave blank for unlimited."
                        type="number"
                        value={maxRebalancesPerDay}
                        onChange={(e) => setMaxRebalancesPerDay(e.target.value)}
                        placeholder="Leave blank for unlimited"
                      />
                      <Input
                        label="Max Rebalances Per Hour"
                        description="Maximum number of rebalances allowed per hour. Leave blank for unlimited."
                        type="number"
                        value={maxRebalancesPerHour}
                        onChange={(e) => setMaxRebalancesPerHour(e.target.value)}
                        placeholder="Leave blank for unlimited"
                      />
                      <Input
                        label="Max Turnover Token0 24h"
                        description="Maximum turnover for token0 in the last 24 hours. Leave blank for unlimited."
                        type="number"
                        value={maxTurnoverToken0}
                        onChange={(e) => setMaxTurnoverToken0(e.target.value)}
                        placeholder="Leave blank for unlimited"
                      />
                      <Input
                        label="Max Turnover Token1 24h"
                        description="Maximum turnover for token1 in the last 24 hours. Leave blank for unlimited."
                        type="number"
                        value={maxTurnoverToken1}
                        onChange={(e) => setMaxTurnoverToken1(e.target.value)}
                        placeholder="Leave blank for unlimited"
                      />
                      <Input
  label="Circuit Max Base Fee (gwei)"
  description="Maximum base fee in gwei before circuit breaker triggers"
  type="number"
  value={circuitMaxBaseFeeGwei}
  onChange={(e) => setCircuitMaxBaseFeeGwei(e.target.value)}
  placeholder="e.g. 100"
/>

<Input
  label="Circuit Move %"
  description="Minimum % move to trigger circuit breaker"
  type="number"
  value={circuitMovePct}
  onChange={(e) => setCircuitMovePct(e.target.value)}
  placeholder="e.g. 2"
/>

<Input
  label="Circuit Tick Jump"
  description="Minimum tick jump before rebalancing"
  type="number"
  value={circuitTickJump}
  onChange={(e) => setCircuitTickJump(e.target.value)}
  placeholder="e.g. 50"
/>

                    </>
                  )}
                </ModalBody>
                <ModalFooter>
                  {currentStep === 1 ? (
                    <Button
                      onPress={() => setCurrentStep(2)}
                    >
                      Next
                    </Button>
                  ) : currentStep === 2 ? (
                    <>
                      <Button
                        onPress={() => setCurrentStep(1)}
                      >
                        Back
                      </Button>
                      <Button
                        onPress={() => setCurrentStep(3)}
                      >
                        Next
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onPress={() => setCurrentStep(2)}
                      >
                        Back
                      </Button>
                      <Button
                        onPress={handleStartBot}
                        isLoading={loading}
                        color="primary"
                      >
                        {loading ? null : "Start Bot"}
                      </Button>
                    </>
                  )}
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {loading ? (
          <div className="flex justify-center"><Loader2 className="animate-spin text-blue-500 size-12" /></div>
        ) : (
          <Tabs fullWidth variant="underlined" aria-label="Bot Status Tabs" className="mb-8">
            <Tab key="active" title="Active Bots">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeBots.map((bot) => <BotCard key={bot.bot_id} bot={bot} isActive={true} />)}
                {activeBots.length === 0 && <p className="text-gray-400">No active bots</p>}
              </div>
            </Tab>
            <Tab key="inactive" title="Inactive Bots">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unactiveBots.map((bot) => <BotCard key={bot.bot_id} bot={bot} isActive={false} />)}
                {unactiveBots.length === 0 && <p className="text-gray-400">No inactive bots</p>}
              </div>
            </Tab>
          </Tabs>
        )}
      </div>
    </div>
  );
}