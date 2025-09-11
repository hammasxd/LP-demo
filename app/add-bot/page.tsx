"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { ThemeSwitch } from "@/components/theme-switch";

export default function LiquidityForm() {
  const [token0, setToken0] = useState("ETH");
  const [token1, setToken1] = useState("USDC");
  const [feeTier, setFeeTier] = useState("0.05");
  const [currentStep, setCurrentStep] = useState(1);
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");

  const tokens = [
    { label: "ETH", value: "ETH" },
    { label: "USDC", value: "USDC" },
    { label: "DAI", value: "DAI" },
    { label: "USDT", value: "USDT" },
  ];

  const feeTiers = [
    { label: "0.05% fee tier", value: "0.05" },
    { label: "0.3% fee tier", value: "0.3" },
    { label: "1% fee tier", value: "1" },
  ];

  const handleNext = () => {
    setCurrentStep(2);
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleSubmit = () => {
    console.log("Selected Pair:", token0, token1);
    console.log("Fee Tier:", feeTier);
    console.log("Amounts:", amount0, amount1);
    // Here you can call your API or bot start function
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">

      <div className="w-full p-6">
        <div className=" space-y-6">
          <div className="flex flex-row justify-between">
            <h1 className="text-2xl font-bold">Liquidity Provision Bot</h1>
            <ThemeSwitch/>
          </div>

          <p className="text-sm">
            This bot automates liquidity provision on decentralized exchanges. Select your token pair and fee tier, then specify the amounts to add liquidity efficiently and securely.
          </p>

          {currentStep === 1 && (
            <>
              {/* Select Pair */}
              <div>
                <h2 className="text-lg font-semibold ">Select pair</h2>
                <p className="text-sm">
                  Choose the tokens you want to provide liquidity for.
                </p>
                <div className="flex gap-3 mt-3">
                  <Select
                    label="Token 1"
                    selectedKeys={[token0]}
                    onSelectionChange={(keys) => setToken0(Array.from(keys)[0] as string)}
                  >
                    {tokens.map((t) => (
                      <SelectItem key={t.value}>{t.label}</SelectItem>
                    ))}
                  </Select>

                  <Select
                    label="Token 2"
                    selectedKeys={[token1]}
                    onSelectionChange={(keys) => setToken1(Array.from(keys)[0] as string)}
                  >
                    {tokens.map((t) => (
                      <SelectItem key={t.value}>{t.label}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Fee Tier */}
              <div>
                <h2 className="text-lg font-semibold ">Fee tier</h2>
                <p className="text-sm ">
                  The amount earned providing liquidity. Choose an amount that suits your risk tolerance and strategy.
                </p>
                <Select
                  label="Fee Tier"
                  selectedKeys={[feeTier]}
                  onSelectionChange={(keys) => setFeeTier(Array.from(keys)[0] as string)}
                  className="mt-3"
                >
                  {feeTiers.map((f) => (
                    <SelectItem key={f.value}>{f.label}</SelectItem>
                  ))}
                </Select>
              </div>

              {/* Next Button */}
              <Button
                fullWidth
                size="lg"
                className=" rounded-xl"
                onPress={handleNext}
              >
                Next
              </Button>
            </>
          )}

          {currentStep === 2 && (
            <>
              {/* Summary */}
              <div>
                <h2 className="text-lg font-semibold ">Provide Liquidity Amounts</h2>
                <p className="text-sm ">
                  Enter the amounts for {token0}/{token1} at {feeTier}% fee tier.
                </p>
              </div>

              {/* Amounts */}
              <div className="space-y-4">
                <Input
                  label={`Amount of ${token0}`}
                  type="number"
                  step="any"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  placeholder="0.0"
                />
                <Input
                  label={`Amount of ${token1}`}
                  type="number"
                  step="any"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  placeholder="0.0"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <Button
                  fullWidth
                  size="lg"
                  className="bg-transparent border  rounded-xl"
                  onPress={handleBack}
                >
                  Back
                </Button>
                <Button
                  fullWidth
                  size="lg"
                  className=" rounded-xl"
                  onPress={handleSubmit}
                >
                  Submit
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}