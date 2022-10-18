import { CosmosMessage } from '@subql/types-cosmos';
import junoInof from '../data/junoInfo.json'

export async function handleJunoMsg(msg: CosmosMessage) : Promise<void> {
    // const contract = msg.contract;
    // const pairs = junoInof.map((item)=> item.swap_address)
    // if( pairs.includes(contract)){
    //   logger.warn(JSON.stringify(msg.msg.msg))
    //   if(msg.msg.msg?.['swap']){
    //     // const res = msg.msg.msg?.['swap'];
    //     // const inputTokken = res.input_token;
    //     // const inputAmount = res.input_amount;
    //     // const min_output = res.inp
    //     logger.info(JSON.stringify(msg));
    //     throw "end"
  
    //   }
    // }
  }
  