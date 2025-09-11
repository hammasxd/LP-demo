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
  timestamp: string;
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
  const [tickData, setTickData] = useState<{ [bot_id: string]: TickData[] }>({});
  const wsRef = useRef<WebSocket | null>(null);
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
const positionManager = new ethers.Contract(
  process.env.NEXT_PUBLIC_POSITION_MANAGER_ADDRESS as string,
  NFTPositionManagerABI,    
  provider
);
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
    const ws = new WebSocket("ws://localhost:8000/ws/graph");
    wsRef.current = ws;

    ws.onopen = () => console.log("WebSocket connected");
    ws.onmessage = (event) => {
      const data: TickData = JSON.parse(event.data);
      setTickData((prev) => ({
        ...prev,
        [data.bot_id]: [...(prev[data.bot_id] || []).slice(-50), data], // Keep last 50 points
      }));
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

  const handleStartBot = async () => {
    setLoading(true);
    try {
      const payload = {
        token0_address: token0,
        token1_address: token1,
        token0_amount: parseFloat(amount0),
        token1_amount: parseFloat(amount1),
        POOL_FEE: parseInt(feeTier),
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

 const BotCard = ({ bot, isActive }: { bot: ActiveBot; isActive: boolean }) => {
  const token0Info = tokens.find((t) => t.value === bot.token0_address);
  const token1Info = tokens.find((t) => t.value === bot.token1_address);
  const token0Label = token0Info?.label || bot.token0_address.slice(0, 6);
  const token1Label = token1Info?.label || bot.token1_address.slice(0, 6);
  const Token0Icon = token0Info?.icon || WETHIcon;
  const Token1Icon = token1Info?.icon || USDCIcon;
  const [FeesLoading, setFeesLoading] = useState(false);
  const [fees, setFees] = useState<{ token0Fees: string; token1Fees: string }>({ token0Fees: "0", token1Fees: "0" });
  const chartRef = useRef<any>(null);
    const fetchFees = async () => {
        setFeesLoading(true);
        try {
          console.log("Fetching fees for position ID:", bot.position_id);
          const positionFees = await positionManager.positions(bot.position_id);
          setFees({
            token0Fees: ethers.formatUnits(positionFees.tokensOwed0, 6), // Assuming USDC has 6 decimals
            token1Fees: ethers.formatUnits(positionFees.tokensOwed1, 18), // Assuming WETH has 18 decimals
          });
        } catch (err) {
          console.error("Failed to fetch fees:", err);
          addToast({
            title: "Error",
            description: "Failed to fetch fees for bot",
            timeout: 5000,
            shouldShowTimeoutProgress: true,
          });
        } finally {
          setFeesLoading(false);
        }
      };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        title: { display: true, text: "Tick", color: "#d1d5db" },
        min: tickData[bot.bot_id]?.[0]?.lower_tick || 0,
        max: tickData[bot.bot_id]?.[0]?.upper_tick || 1000,
        grid: { color: "rgba(209, 213, 219, 0.1)" },
        ticks: { color: "#d1d5db" },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `Tick: ${context.raw.toFixed(0)}`,
        },
      },
    },
  };

  const initialChartData = {
    labels: [],
    datasets: [
      {
        label: "Current Tick",
        data: [],
        borderColor: "#3b82f6",
        backgroundColor: (ctx: any) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 150);
          gradient.addColorStop(0, "rgba(59, 130, 246, 0.4)");
          gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
          return gradient;
        },
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointBackgroundColor: "#3b82f6",
      },
    ],
  };

  // Efficiently update chart data when new ticks arrive
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    const ticks = tickData[bot.bot_id]?.map((d) => d.tick) || [];
    const labels = tickData[bot.bot_id]?.map((d) => "") || [];

    chart.data.labels = labels;
    chart.data.datasets[0].data = ticks;
    chart.update("none"); // 'none' prevents animation for smooth tick movement
  }, [tickData[bot.bot_id]]);

  return (
      <Card className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-xl shadow-lg overflow-hidden border border-blue-500/50">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="text-lg font-bold">Bot ID: {bot.bot_id.slice(0, 8)}...</div>
            <span className={`text-sm px-2 py-1 rounded-full ${isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold">Position ID:</span>
            <span>{bot.position_id}</span>
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
            {FeesLoading ? (
              <Loader2 className="animate-spin h-4 w-4 text-gray-400" />
            ) : (
              <span>
                {Number(fees.token0Fees).toFixed(6)} {token0Label}, {Number(fees.token1Fees).toFixed(6)} {token1Label}
              </span>
            )}
            <Button size="sm" variant="light" onPress={fetchFees} disabled={FeesLoading}>
              Refresh
            </Button>
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
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Liquidity Bot Dashboard</h1>
          <ThemeSwitch />
        </div>

        <Button
          onPress={onOpen}
          className="mb-8 transition-all duration-300 rounded-xl bg-gradient-to-br from-blue-900 to-purple-900"
        >
          <Plus className="mr-2" /> Add New Bot
        </Button>

        <Modal
          backdrop="blur"
          isOpen={isOpen}
          onClose={() => {
            onClose();
            setCurrentStep(1);
            setAmount0("");
            setAmount1("");
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
                        startContent={<div className="flex items-center">{tokens.find(t => t.value === token0)?.icon({ className: "text-xl text-blue-400" })}</div>}
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
                        startContent={<div className="flex items-center">{tokens.find(t => t.value === token1)?.icon({ className: "text-xl text-blue-400" })}</div>}
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
                        onChange={(e) => setAmount0(e.target.value)}
                        endContent={<span className="text-default-400 text-small">{tokens.find((t) => t.value === token0)?.label}</span>}
                        placeholder="0.00"
                      />
                      <Input
                        label={`Amount of ${tokens.find((t) => t.value === token1)?.label}`}
                        description={`Enter the amount of ${tokens.find((t) => t.value === token1)?.label} to provide`}
                        type="number"
                        value={amount1}
                        onChange={(e) => setAmount1(e.target.value)}
                        endContent={<span className="text-default-400 text-small">{tokens.find((t) => t.value === token1)?.label}</span>}
                        placeholder="0.00"
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
                  ) : (
                    <>
                      <Button
                        onPress={() => setCurrentStep(1)}
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