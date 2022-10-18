import { BigNumber } from 'bignumber.js'

BigNumber.config({
  DECIMAL_PLACES: 6,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
})

export function num(number: number | string): BigNumber {
  return new BigNumber(number)
}
export const div = (a?: BigNumber.Value, b?: BigNumber.Value): string =>
    new BigNumber(a || 0).div(b || 1).toString()

export const multiple = (a?: BigNumber.Value, b?: BigNumber.Value): string =>
    new BigNumber(a || 0).multipliedBy(b || 1).toString()

export function aprToApy(apr: string): string {
  return !num(apr).isNaN() && apr !== '0'
    ? num(1).plus(num(apr).dividedBy(365)).pow(365).minus(1).toFixed(4)
    : '0'
}

export * from 'bignumber.js'
