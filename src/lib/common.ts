export function splitTokenAmount(tokenAmount: string): { token: string; amount: string } {
    const m = tokenAmount.match(/^([0-9]+(\.[0-9]+)?)([a-zA-Z0-9]+)$/)
    if (m === null) {
      throw new Error('failed to parse to token amount: ' + tokenAmount) 
    }
    const tok = (m[3]?.startsWith('juno') || m[3]?.startsWith('u')) ? m[3] : `ibc/${m[3]?.replace('ibc','')}`;

    return { token: tok, amount: m[1] }
  }