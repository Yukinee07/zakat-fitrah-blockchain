import { useMemo } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../contexts/Web3Context";
import contractABI from "../abi/ZakatFitrah.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const RPC_URL          = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

export function useContract() {
  const { signer, provider } = useWeb3();

  return useMemo(() => {
    const abi = contractABI.abi;
    if (!CONTRACT_ADDRESS) return null;
    // Use signer when connected, fallback to read-only provider.
    const runner = signer ?? (provider ?? new ethers.JsonRpcProvider(RPC_URL));
    return new ethers.Contract(CONTRACT_ADDRESS, abi, runner);
  }, [signer, provider]);
}
