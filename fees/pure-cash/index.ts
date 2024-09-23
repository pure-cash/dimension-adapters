import { request, gql } from "graphql-request";
import { Chain } from "@defillama/sdk/build/general";
import { CHAIN } from "../../helpers/chains";
import { getBlock } from "../../helpers/getBlock";
import { FetchV2, SimpleAdapter } from "../../adapters/types";

const ETH_MARKET_ID = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

type GraphEndpoint = {
  [s: string | Chain]: string;
};

const endpoints: GraphEndpoint = {
  [CHAIN.ETHEREUM]:
    "https://api.studio.thegraph.com/query/89359/pure-cash-stats-mainnet/version/latest",
};

const methodology = {
  Fees: "Fees for open/close position and mint/burn PUSD, as well as add liquidity.",
  Revenue: "Income for LP providers.",
};

const queryFee = gql`
  query query_fee($id: String!, $number: Int!) {
    markets(block: { number: $number }, where: { id: $id }) {
      totalProtocolFeeUSD
      tradingFeeUSD
    }
  }
`;

interface MarketsResponse {
  markets: [
    {
      totalProtocolFeeUSD: string;
      tradingFeeUSD: string;
    }
  ];
}

const getFetch =
  () =>
  (chain: Chain): FetchV2 =>
  async ({ startOfDay }) => {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const nextStartOfDay = startOfDay + ONE_DAY_IN_SECONDS;
    const endTimestamp =
      currentTimestamp > nextStartOfDay ? nextStartOfDay : currentTimestamp;
    const startBlock = await getBlock(startOfDay, chain, {});
    const endBlock = await getBlock(endTimestamp, chain, {});

    const startGraphRes: MarketsResponse = await request(
      endpoints[chain],
      queryFee,
      {
        id: ETH_MARKET_ID,
        number: startBlock,
      }
    );
    const endGraphRes: MarketsResponse = await request(
      endpoints[chain],
      queryFee,
      {
        id: ETH_MARKET_ID,
        number: endBlock,
      }
    );

    const dailyFee =
      parseFloat(endGraphRes.markets[0].totalProtocolFeeUSD) -
      parseFloat(startGraphRes.markets[0].totalProtocolFeeUSD);
    const dailyRevenue =
      parseFloat(endGraphRes.markets[0].tradingFeeUSD) -
      parseFloat(endGraphRes.markets[0].totalProtocolFeeUSD) -
      (parseFloat(startGraphRes.markets[0].tradingFeeUSD) -
        parseFloat(startGraphRes.markets[0].totalProtocolFeeUSD));

    return {
      timestamp: startOfDay,
      dailyFees: dailyFee.toString(),
      dailyRevenue: dailyRevenue.toString(),
    };
  };

const adapter: SimpleAdapter = {
  version: 2,
  adapter: {
    [CHAIN.ETHEREUM]: {
      fetch: getFetch()(CHAIN.ETHEREUM),
      start: 1726531200,
      meta: {
        methodology,
      },
    },
  },
};

export default adapter;
