import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

const Web3Context = createContext(null);

const REQUIRED_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || "31337");
const CHAIN_NAME        = import.meta.env.VITE_CHAIN_NAME || "Localhost";
const RPC_URL           = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

export function Web3Provider({ children }) {
  const [provider, setProvider]           = useState(null);
  const [signer, setSigner]               = useState(null);
  const [account, setAccount]             = useState(null);
  const [chainId, setChainId]             = useState(null);
  const [isCorrectNetwork, setIsCorrect]  = useState(false);

  const checkNetwork = useCallback((id) => {
    setIsCorrect(Number(id) === REQUIRED_CHAIN_ID);
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask not found");
    const prov   = new ethers.BrowserProvider(window.ethereum);
    const accounts = await prov.send("eth_requestAccounts", []);
    const network  = await prov.getNetwork();
    const sign     = await prov.getSigner();

    setProvider(prov);
    setSigner(sign);
    setAccount(accounts[0]);
    setChainId(Number(network.chainId));
    checkNetwork(Number(network.chainId));
  }, [checkNetwork]);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setIsCorrect(false);
  }, []);

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    const chainHex = "0x" + REQUIRED_CHAIN_ID.toString(16);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId:         chainHex,
            chainName:       CHAIN_NAME,
            rpcUrls:         [RPC_URL],
            nativeCurrency:  { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
          }],
        });
      } else {
        throw err;
      }
    }
  }, []);

  // Re-connect if already authorised on mount.
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
      if (accounts.length > 0) connect().catch(() => {});
    });

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnect();
      else connect().catch(() => {});
    };
    const handleChainChanged = (id) => {
      setChainId(Number(id));
      checkNetwork(Number(id));
      window.location.reload(); // safest approach per MetaMask docs
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged",    handleChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged",    handleChainChanged);
    };
  }, [connect, disconnect, checkNetwork]);

  return (
    <Web3Context.Provider
      value={{ provider, signer, account, chainId, isCorrectNetwork,
               connect, disconnect, switchToSepolia }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used inside Web3Provider");
  return ctx;
}
