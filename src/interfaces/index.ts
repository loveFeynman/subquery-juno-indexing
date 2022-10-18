import { TxType } from "../types"

export type SwapType = {
    _contract_address: string
    action: string
    sender: string
    receiver: string
    offer_asset: string
    ask_asset: string
    offer_amount: string
    return_amount: string
    spread_amount: string
    commission_amount: string
    from: string
    to: string
    amount: string
}

export const defaultSwap = {
    _contract_address: "",
    action: "",
    sender: "",
    receiver: "",
    offer_asset: "",
    ask_asset: "",
    offer_amount: "",
    return_amount: "",
    spread_amount: "",
    commission_amount: "",
    from: "",
    to: "",
    amount: ""
}

export const defaultProvide = {
    _contract_address: "",
    action: "",
    sender: "",
    receiver: "",
    assets: "",
    from: "",
    to: "",
    amount: "",
    by: "",
    share: ""
}

export const defaultWithdraw = {
    _contract_address: "",
    action: "",
    sender: "",
    receiver: "",
    refund_assets: "",
    from: "",
    to: "",
    amount: "",
    by: "",
    withdrawn_share: "0"
}

export type TradingHistoryEntity =  {
    id: number,
    token: string
    second_token: string
    pair_addr: string
    base_volume: string
    target_volume: string
    price: string
    datetime: Date
    lpToken: string
    return_amount: string
    offer_amount: string
    pair: string
    txType: TxType
}

export interface TokenPriceType {
    token: string
    name: string
    symbol: string
    decimals: 6
    total_supply: string
    unitPrice: string
    updated_at: string
  }