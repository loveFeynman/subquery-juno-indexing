import assets from '../data/assets.json'

export const isNative = (addr?: string) => {
    return addr ? (assets[addr] ? assets[addr].isNative : false) : false
}

export const isUusd = (addr?: string) => {
    return addr ? assets[addr]?.symbol === 'USDC' ? true : false : false
}