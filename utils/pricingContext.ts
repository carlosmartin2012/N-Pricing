import { MOCK_LIQUIDITY_CURVES } from './seedData';
import type {
  BehaviouralModel,
  BusinessUnit,
  ClientEntity,
  DualLiquidityCurve,
  FtpRateCard,
  GeneralRule,
  GreeniumRateCard,
  PhysicalRateCard,
  ProductDefinition,
  TransitionRateCard,
  YieldCurvePoint,
} from '../types';
import type { PricingContext } from './pricingEngine';

interface PricingContextSource {
  yieldCurves: YieldCurvePoint[];
  liquidityCurves?: DualLiquidityCurve[];
  rules: GeneralRule[];
  ftpRateCards: FtpRateCard[];
  transitionGrid: TransitionRateCard[];
  physicalGrid: PhysicalRateCard[];
  greeniumGrid?: GreeniumRateCard[];
  behaviouralModels: BehaviouralModel[];
}

interface PricingContextEntities {
  clients: ClientEntity[];
  products: ProductDefinition[];
  businessUnits: BusinessUnit[];
}

export function resolveLiquidityCurves(
  liquidityCurves?: DualLiquidityCurve[],
): DualLiquidityCurve[] {
  return liquidityCurves?.length ? liquidityCurves : MOCK_LIQUIDITY_CURVES;
}

export function getPrimaryLiquidityPoints(
  liquidityCurves?: DualLiquidityCurve[],
) {
  return resolveLiquidityCurves(liquidityCurves)[0]?.points ?? [];
}

export function buildPricingContext(
  source: PricingContextSource,
  entities: PricingContextEntities,
): PricingContext {
  return {
    yieldCurve: source.yieldCurves,
    liquidityCurves: resolveLiquidityCurves(source.liquidityCurves),
    rules: source.rules,
    rateCards: source.ftpRateCards,
    transitionGrid: source.transitionGrid,
    physicalGrid: source.physicalGrid,
    greeniumGrid: source.greeniumGrid ?? [],
    behaviouralModels: source.behaviouralModels,
    clients: entities.clients,
    products: entities.products,
    businessUnits: entities.businessUnits,
  };
}
