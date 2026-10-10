import type { PaperAsset } from "./simulation/paper";

/** Canonical Pyth Core USD feeds used by the devnet paper exchange. */
export const PAPER_PYTH_FEEDS: Record<PaperAsset, string> = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  XRP: "ec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
  ADA: "2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
  DOGE: "dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  AVAX: "93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
  LINK: "8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  DOT: "ca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b",
  LTC: "6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54",
  BCH: "3dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a3",
  UNI: "78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501",
  AAVE: "2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445",
  SUI: "23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  ATOM: "b00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819",
  NEAR: "c415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750",
  ETC: "7f5cc8d963fc5b3d2ae41fe5685ada89fd4f14b435f8050f28c7fd409f40c2d8",
  XLM: "b7a8eba68a997cd0210c2e1e4ee811ad2d174b3611c22d9ebf16f4cb7e9ba850",
  HBAR: "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd",
  SHIB: "f0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a",
};

/**
 * Pyth Push Oracle shard-zero PDAs, derived from the feed IDs above and
 * `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT`. Keeping the resolved
 * addresses in the browser avoids bundling the server-side pusher SDK.
 */
const PAPER_PYTH_PRICE_ACCOUNTS: Record<PaperAsset, string> = {
  BTC: "4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo",
  ETH: "42amVS4KgzR9rA28tkVYqVXjq9Qa8dcZQMbH5EYFX6XC",
  SOL: "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
  XRP: "Ae3LGcV5Wt5Z11xvhxSX1h65uNyjuX4qYFFbgifLx5eX",
  ADA: "EWJioo2ZMLRbgUaPpj34aNpNX7HGXTmXsCKtpMUskY9t",
  DOGE: "681QkKLoAQrB5h23Ewq9c8rjM19RBuzqwXZf2RPr9Pyw",
  AVAX: "HUBqpBf3aGJdVQndFHmMUd1eMcixt7S4swYPCx8A93K1",
  LINK: "7bWHpGtb2j3jqbpA5gFctdmgZELubiZDBxmt1pEzkBHR",
  DOT: "fGScMgu2Hb5re5iqEJWgq4VqJMrBRvrrB7bsPdzhSZK",
  LTC: "2ciNmEPiMDgW6kTzHm3BDyX5qsvFTLyLk278RHSmfdt4",
  BCH: "C7bQTHZDPG7R9efbxTdEgoipnrDFvc4EoVX9Sjxwqmjd",
  UNI: "By6KRq5KjvEmsjumNGBXQWyedaV3sAq89yjiFm6Poy3k",
  AAVE: "38aAZxne9JkspNZPzz5oqtLHWKVDAZuP4ZTcnkGfJSJg",
  SUI: "GgV3a7YeVRga9prjNGEDBG9NwatSaD8rwjZ4GNjPiXTq",
  ATOM: "4Kq7ApLLSSztfg3Nf9LQFboTi347VhS3bMx5r6F1ku5P",
  NEAR: "4Ag6xt275tDDkdWhFsCq3vTHAvNAzKVRNiqAswzb699A",
  ETC: "5Ua37mfwfnQ7vee3VSzsRp7WprQSJJBxyub8HJ9g3BEk",
  XLM: "E7grkANVfSuj34Wd9mwAscE4uTc8VapiV3YbwzdzXu6W",
  HBAR: "F2szvcgc12YBW9MqPj1k8n8zAAivRow7Mvart5GDyk6m",
  SHIB: "FkphkegaYbsZdjQki1PMngmrvkLZczujiJEbibm877AQ",
};

export function getPaperPriceFeedAddress(asset: PaperAsset) {
  return PAPER_PYTH_PRICE_ACCOUNTS[asset];
}
