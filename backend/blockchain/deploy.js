const Web3 = require("web3");
const solc = require("solc");
const fs = require("fs");

const web3 = new Web3("http://127.0.0.1:7545");

async function deploy() {
  const accounts = await web3.eth.getAccounts();

  const source = fs.readFileSync("./GasGuard.sol", "utf8");

  const input = {
    language: "Solidity",
    sources: { "GasGuard.sol": { content: source } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const contract = output.contracts["GasGuard.sol"]["GasGuard"];

  const result = await new web3.eth.Contract(contract.abi)
    .deploy({ data: contract.evm.bytecode.object })
    .send({ from: accounts[0], gas: 3000000 });

  console.log("Contract Address:", result.options.address);

  fs.writeFileSync(
    "./contract.json",
    JSON.stringify({ abi: contract.abi, address: result.options.address }, null, 2)
  );
}

deploy();
