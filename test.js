
// const tokenInfoResponse = async () => {
//   const response = await fetch('https://lite-api.jup.ag/tokens/v1/tagged/verified')
//   const data = await response.json()
//   return data
// }

const tokenInfoResponse = async () => {
  const response = await fetch('https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=5758394&slippageBps=50&restrictIntermediateTokens=true')
  const data = await response.json()
  return data
}

const production = async () => {
  const response = await fetch('https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=5758394&slippageBps=50&restrictIntermediateTokens=true')
  const data = await response.json()
  return data
}


// let tokenInfo = await tokenInfoResponse()
let productionInfo = await production()
// console.log(tokenInfo)
console.log(productionInfo)

