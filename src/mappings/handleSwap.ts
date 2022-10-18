import { CosmosEvent } from "@subql/types-cosmos";
import pairsList from "../data/pairs.json";
import assets from "../data/assets.json";
import {
  defaultProvide,
  defaultSwap,
  defaultWithdraw,
  TradingHistoryEntity,
} from "../interfaces";
import { isNative, isUusd } from "../lib/config";
import { multiple, num } from "../lib/num";
import {
  FeeVolume,
  Positions,
  Price,
  TradingHistory,
  TradingVolume,
  Tx,
  TxType,
} from "../types";
import { Attribute } from "@cosmjs/stargate/build/logs";
import { splitTokenAmount } from "../lib/common";

export type MsgExecuteContract = {
  typeUrl: string;
  sender: string;
  contract: string;
  msg: string | object;
  funds: [];
};

export const parseMsg = (msg: any) => {
  return msg as MsgExecuteContract;
};

const enum KEY {
  SWAP = "swap",
  PROVIDE_LIQUIDITY = "provide_liquidity",
  WITHDRAW_LIQUIDITY = "withdraw_liquidity",
}
export const parseAttributes = async (
  attr: Attribute[],
  type: string,
  defaultVal: any
) => {
  let data = defaultVal;

  attr.map(({ key, value }) => {
    let obj = {};
    if (key === "_contract_address") {
      if(type === KEY.WITHDRAW_LIQUIDITY){
        const lp = Object.keys(pairsList).find((item) => value === pairsList[item]);
        if(lp){
          obj =  { [key]: value }
        }
      }
      else if(pairsList[value]){
        obj =  { [key]: value }
      }else{
        obj = {}
      }
    }
    else if (key === "action") {
      if ([type].includes(value)) {
        obj =  { [key]: value };
      }
    }
    else {
      obj = { [key]: value };
    }
    data = { ...data, ...obj };
  });

  return data;
};

export const checkType = (attr: Attribute[], type: string) => {
  return attr.find(({ key, value }) => key === "action" && value === type);
};

export async function handleEvent(event: any): Promise<void> {
  // const listTx = [];
  
  // logger.info(attr)
  // logger.info(event);
  // Optimized code
  /*let attributes = [...attr].slice(1)
  const actionLength = attributes.filter(({key}) => key === 'action')
  let obj = {}
  const address = attr[0].value

  if(pairsList[address] || Object.keys(pairsList).find((item) => pairsList[item] === address)){
    attributes?.map(({key, value}, index) =>{
      if((index === attributes.length -1 && actionLength.length == 1)){
         // having one action only
        listTx.push({...obj, [key]: value, address: address})
        obj = {}
      }else if(
        (index !== 0 && (key === 'action' && actionLength.length > 1)) ||
         (index === attributes.length -1 )
         ){
        // having multiple actions OR end of array
        if(index === attributes.length -1){
          // add last index and value
          obj[key] = value
        }
        listTx.push({...obj, address: address})
        obj = {}
      }
      obj[key] = value
    })
  }*/

  // await bluebird.mapSeries(listTx, async (ev) => {
  // let filter = {}
  // if (
  //   ev.action !== undefined &&
  //   ['swap', 'provide_liquidity', 'withdraw_liquidity'].includes(ev.action)
  // ) {
  //   filter = { type: 'pair' }
  // }

  // if (
  //     ev.action !== undefined &&
  //     ['mint', 'burn'].includes(ev.action)
  // ) {
  //   filter = { type: 'lpToken' }
  // }
  // logger.info("data2")
  // const contract = await contractsService().get(
  //   { address: ev.address, ...filter },
  //   undefined,
  //   contractsRepo
  // );
  //   if(true){
  //   return
  // }
  // })
  const datetime = new Date(Date.parse(event.block.block.header.time));
  const blockHeight = event.block.block.header.height
  const hash = event.tx.hash
  const eventt = event
  const attr = event.event.attributes;
  // I can see the stuff here???
  // logger.info(`Event data ${JSON.stringify(attr)}`)
  // logger.info(`Handling ${hash} from ${blockHeight}`)
  if (checkType(attr, KEY.SWAP)) {
    logger.info(attr);
    const data = await parseAttributes(attr, KEY.SWAP, defaultSwap);
    logger.info("Dealing with swap from contract "+data._contract_address)

    let pair = isNative(data.offer_asset)
      ? data.from
      : data._contract_address;
      
    if(!pair || pair == '' || pair.length <= 0){
      pair = data._contract_address
    }

    logger.info("pair "+ pair)
    if (!pairsList[pair]) {
      logger.info("Related Tx skipped (swap). please review");
      return;
    }

    const {
      offer_amount,
      return_amount,
      ask_asset,
      offer_asset,
      spread_amount,
      commission_amount,
      lpShare,
    } = data;
    const type = isNative(offer_asset) ? TxType.BUY : TxType.SELL
    const volume =
      type === TxType.BUY
        ? offer_amount
        : num(return_amount)
            .plus(spread_amount)
            .plus(commission_amount)
            .toString();

    const price = type === TxType.BUY
            ? num(offer_amount).dividedBy(return_amount).toString()
            : num(return_amount).dividedBy(offer_amount).toString()

    /**
     * Ssve Stats Data for Charts
     */
    const priceOfAsk = await getPrice(pair, data.ask_asset);
    const tokenPrice = isUusd(data.ask_asset) ? "1" : priceOfAsk ?? "1";
    await saveVolume({ timestamp: datetime.getTime(), volume: multiple(volume, tokenPrice), pair });

    /**
     * offer asset will be + plus
     * ask asset will be - minus
     */
    await adjustPositionNPrice({
      token1: {
        token: offer_asset,
        amount: offer_amount,
      },
      token2: {
        token: ask_asset,
        amount: `-${return_amount}`,
      },
      pair,
      datetime,
      lpToken: pairsList[pair],
      lpShare: lpShare, // mint lp
      volume,
      hash
    });
    logger.info("position passed "+ pair)
    /**
     * Save Fee and Volume
     */
    await saveFeeAndVolume({
      timestamp: datetime.getTime(),
      pair,
      lp: pairsList[pair],
      offerAsset: offer_asset,
      askAsset: ask_asset,
      returnAmount: return_amount,
      commissionAmount: commission_amount,
    });

    /**
     * Save Trading History
     */
    const save = {
      token: offer_asset,
      second_token: ask_asset,
      return_amount: return_amount,
      offer_amount: offer_amount,
      price,
      datetime,
      lpToken: pairsList[pair],
      pair,
      txType: TxType.SELL,
      id: 1,
    } as TradingHistoryEntity;
    await saveHistory(save, event);

    const saveSell = {
      token: ask_asset,
      second_token: offer_asset,
      return_amount: return_amount,
      offer_amount: offer_amount,
      price,
      datetime,
      lpToken: pairsList[pair],
      pair,
      txType: TxType.BUY,
      id: 2,
    } as TradingHistoryEntity;
    await saveHistory(saveSell, event);

    logger.info("saving tx "+ commission_amount+" "+ datetime.getTime());
    // save tx
    await saveTx({timestamp: datetime.getTime(), hash: hash, height: blockHeight, token: ask_asset, volume: volume, commission: commission_amount, type: TransactionType.SWAP, pair: pair });
  }

  if (checkType(attr, KEY.PROVIDE_LIQUIDITY)) {
    const data = await parseAttributes(
      attr,
      KEY.PROVIDE_LIQUIDITY,
      defaultProvide
    );
    logger.info("Dealing with Provide LP from contract "+data._contract_address)

    const { _contract_address: pair, assets, share } = data;
    logger.info("pair "+ pair)
    if (!pairsList[pair]) {
      logger.info("Related Tx skipped (provide liquidity). please review ");
      return;
    }
    const liquidities = assets
      .split(", ")
      .map((assetAmount) =>
        splitTokenAmount(
          assetAmount.includes("ibc/")
            ? assetAmount.replace("ibc/", "ibc")
            : assetAmount
        )
      );

    if (liquidities && liquidities.length !== 2) {
      throw `wrong transaction`;
    }

    const assetToken = liquidities[0];
    const uusdToken = liquidities[1];

    await adjustPositionNPrice({
      token1: assetToken,
      token2: uusdToken,
      pair,
      datetime,
      lpToken: pairsList[pair],
      lpShare: share, // mint lp
      volume: '0',
      hash
    });

     // save tx
     await saveTx({timestamp: datetime.getTime(),hash: hash, height: blockHeight,type: TransactionType.PROVIDE_LIQUIDITY, pair: pair });
  }

  if (checkType(attr, KEY.WITHDRAW_LIQUIDITY)) {
    const data = await parseAttributes(
      attr,
      KEY.WITHDRAW_LIQUIDITY,
      defaultWithdraw
    );
    logger.info("Dealing with Withdraw LP from contract "+data._contract_address)

    const { _contract_address: lp, refund_assets, withdrawn_share } = data;
    const pair = Object.keys(pairsList).find((item) => lp === pairsList[item]);
    logger.info("pair "+ pair)

    if (!pair && !lp) {
      logger.info("Related Tx skipped (withdraw liquidity). please review ")
      return;
    }
    
    const liquidities = refund_assets
      .split(", ")
      .map((assetAmount) =>
        splitTokenAmount(
          assetAmount.includes("ibc/")
            ? assetAmount.replace("ibc/", "ibc")
            : assetAmount
        )
      );

    if (liquidities && liquidities.length !== 2) {
      throw `wrong transaction`;
    }

    const assetToken = {
      ...liquidities[0],
      amount: `-${liquidities[0].amount}`,
    };
    const uusdToken = {
      ...liquidities[1],
      amount: `-${liquidities[1].amount}`,
    };

    await adjustPositionNPrice({
      token1: assetToken,
      token2: uusdToken,
      pair,
      datetime,
      lpToken: pairsList[pair],
      lpShare: `-${withdrawn_share}`, // burn lp
      volume: '0',
      hash
    });

     // save tx
     await saveTx({timestamp: datetime.getTime(),hash: hash, height: blockHeight, type: TransactionType.WITHDRAW_LIQUIDITY, pair: pair});
  }
}

export async function saveHistory(
  data: TradingHistoryEntity,
  event: CosmosEvent
) {
  const messageRecord = new TradingHistory(
    `${event.tx.hash}-${event.msg.idx}-${data.id}`
  );
  messageRecord.token = data.token;
  messageRecord.secondToken = data.second_token;
  messageRecord.pairAddr = data.pair;
  messageRecord.baseVolume = data.return_amount;
  messageRecord.targetVolume = data.offer_amount;
  messageRecord.price = data.price;
  messageRecord.datetime = data.datetime;
  messageRecord.txType = data.txType;
  messageRecord.lpToken = data.lpToken;
  await messageRecord.save();
}

async function saveVolume({
  timestamp,
  volume,
  pair,
}: {
  timestamp: number;
  volume: string;
  pair: string;
}) {
  const datetime = new Date(timestamp - (timestamp % 86400000));
  let daily = await TradingVolume.get(`${datetime.getTime()}`);

  if (daily) {
    daily.tradingVolume = num(daily.tradingVolume).plus(volume).toString();
    daily.cumulativeLiquidity = "0";
  } else {
    daily = new TradingVolume(`${datetime.getTime()}`);
    daily.tradingVolume = num(volume).toString();
    daily.pair = pair;
    daily.datetime = datetime;
    daily.cumulativeLiquidity = "0";
  }

  await daily.save();
}

interface Fee {
  timestamp: number;
  pair: string;
  lp: string;
  offerAsset: string;
  returnAmount: string;
  askAsset: string;
  commissionAmount: string;
}

export const getPrice = async (pair: string, token: string) => {
  const position = await Positions.get(pair);
  if (position) {
    const poolAmount = num(position.secondPool)
      .dividedBy(position.pool)
      .toString();
    const uusdPoolAmount = num(position.pool)
      .dividedBy(position.secondPool)
      .toString();
    return position.token === token ? poolAmount : uusdPoolAmount;
  }
  return "0";
};

async function saveFeeAndVolume({
  timestamp,
  pair,
  offerAsset,
  lp,
  returnAmount,
  askAsset,
  commissionAmount,
}: Fee) {
  const datetime = new Date(timestamp - (timestamp % 86400000));
  const id = `${datetime.getTime()+pair+askAsset}`
  let feeEntity = await FeeVolume.get(id);

  let volume = num("0").toString();
  // let fee = "0";
  const tokenAsset = assets[askAsset];
  if (tokenAsset) {
    // const { decimals } = tokenAsset;
    // const vol = num(returnAmount).dividedBy(num(10).pow(decimals)).toString();
    // const priceOfAsk = await getPrice(pair, askAsset);
    // const tokenPrice = isUusd(askAsset) ? "1" : priceOfAsk;
    volume = returnAmount.toString();
    // fee = num(num(commissionAmount).dividedBy(num(10).pow(decimals)).toString())
    //   .times(tokenPrice)
    //   .toString();
  }

  if (feeEntity) {
    logger.info("entity found "+ feeEntity.id+" "+ feeEntity.volume)
    // update volume
    feeEntity.volume = num(feeEntity.volume).plus(volume).toString();
    logger.warn("feeEntity.volume updated "+ feeEntity.volume)
    feeEntity.commission = num(feeEntity.commission).plus(commissionAmount).toString();
  } else {
    feeEntity = new FeeVolume(id);
    feeEntity.offerAsset = offerAsset;
    feeEntity.askAsset = askAsset;
    feeEntity.datetime = datetime;
    feeEntity.volume = volume;
    feeEntity.pair = pair;
    feeEntity.lp = lp;
    feeEntity.tokenFee = "0";
    feeEntity.secondTokenFee = '0';
    feeEntity.commission = commissionAmount
    feeEntity.count = "0"
  }
  logger.warn("id "+ feeEntity.id)
  logger.warn("commi "+ feeEntity.commission)
  logger.warn("vol "+ feeEntity.volume)
  feeEntity.count = num(feeEntity.count).plus("1").toString()
  return feeEntity.save();
}

export async function adjustPositionNPrice({
  pair,
  lpToken,
  token1,
  token2,
  datetime,
  volume,
  lpShare = "0",
    hash,
}: {
  pair: string | any;
  lpToken: string;
  token1: { token: string; amount: string };
  token2: { token: string; amount: string };
  datetime: Date;
  lpShare: string;
  volume: string;
  hash: string;
}): Promise<void> {
  // positions  = pool
  let positions = await Positions.get(pair);
  const token = token1.token;
  const secondToken = token2.token;
  if (!positions) {
    if (token && secondToken) {
      positions = new Positions(pair);
      positions.token = token;
      positions.secondToken = secondToken;
      positions.pool = "0";
      positions.secondPool = "0";
      positions.pair = pair;
      positions.lp = lpToken;
      positions.lpShares = "0";
    } else {
      return;
    }
  }

  if (positions.token == token) {
    positions.pool = num(positions.pool ?? "0")
      .plus(token1.amount)
      .toString();
    positions.secondPool = num(positions.secondPool ?? "0")
      .plus(token2.amount)
      .toString();
  } else {
    positions.secondPool = num(positions.secondPool ?? "0")
      .plus(token1.amount)
      .toString();
    positions.pool = num(positions.pool ?? "0")
      .plus(token2.amount)
      .toString();
  }

  positions.datetime = datetime;
  positions.lpShares = num(positions.lpShares).plus(lpShare).toString();
  await positions.save();

  const poolAmount = num(positions.secondPool)
    .dividedBy(positions.pool)
    .toString();
  const uusdPoolAmount = num(positions.pool)
    .dividedBy(positions.secondPool)
    .toString();

  await savePrice({
    hash: `${hash}-1`,
    price: poolAmount,
    token: positions.token,
    secondToken: positions.secondToken,
    timestamp: datetime.getTime(),
    volume,
    pair,
    lp: lpToken,
  });
  
  await savePrice({
    hash: `${hash}-2`,
    price: uusdPoolAmount,
    token: positions.secondToken,
    secondToken: positions.token,
    volume,
    timestamp: datetime.getTime(),
    pair,
    lp: lpToken,
  });

}

/**
 * Save price history for charts
 */
async function savePrice({
    hash,
  timestamp,
  token,
  secondToken,
  price,
  volume,
  pair,
  lp,
}: {
  hash: string;
  timestamp: number;
  token: string;
  secondToken: string;
  price: string;
  volume: string;
  pair: string;
  lp: string;
}) {
  const datetime = new Date(timestamp - (timestamp % 60000));
  const tokenDet = assets[token];
  const secTokenDet = assets[secondToken];

  if (!tokenDet && !secTokenDet) {
    return;
  }

  let priceEntity = await Price.get(
    `${hash}`
  );

  if (priceEntity) {
    priceEntity.high = num(price).isGreaterThan(priceEntity.high)
      ? price
      : priceEntity.high;
    priceEntity.low = num(price).isLessThan(priceEntity.low)
      ? price
      : priceEntity.low;
    priceEntity.close = price;
    priceEntity.volume = num(priceEntity.volume).plus(volume).toString();
    priceEntity.datetime = datetime;
  } else {
    priceEntity = new Price(
      `${hash}`
    );
    priceEntity.token = token;
    priceEntity.secondToken = secondToken;
    priceEntity.open = price;
    priceEntity.high = price;
    priceEntity.low = price;
    priceEntity.close = price;
    priceEntity.datetime = datetime;
    priceEntity.pair = pair;
    priceEntity.lp = lp;
    priceEntity.volume = volume;
  }
  await priceEntity.save();
}

enum TransactionType {
  SWAP = 'swap',
  PROVIDE_LIQUIDITY = 'provide_liquidity',
  WITHDRAW_LIQUIDITY = 'withdraw_liquidity'
}
/**
 * Save Daily Tx
 */
 async function saveTx({
  hash,
  timestamp,
  height,
  volume,
  commission,
  type,
  pair,
  token
}: {
  hash: string;
  timestamp: number;
  height: bigint;
  volume?: string;
  commission?: string;
  type: string;
  pair: string;
  token?: string
}) {
  const date = new Date(timestamp)
    let tx = new Tx(`${hash+height}`)
    tx.blockHeight = height
    tx.timestamp = date
    tx.type = type
    tx.volume = volume ?? '0'
    tx.token = token ?? ''
    tx.commission = commission ?? '0'
    tx.pair = pair
    await tx.save()
}

function getDate(dateTime){
	return `${dateTime.getDate()}-${dateTime.getMonth() + 1}-${dateTime.getFullYear()}`
}

function main() {
  throw new Error("Function not implemented.");
}

