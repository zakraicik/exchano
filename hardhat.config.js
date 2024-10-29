require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true // Add this line
    }
  }
  // networks: {
  //   hardhat: {
  //     forking: {
  //       url: `https://base-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
  //     }
  //   }
  // }
}
