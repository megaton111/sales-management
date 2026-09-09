import type { ProductCostData, CostHistoryEntry } from '@/hooks/useProductProfits';

export function getEffectiveUnitCost(
  costHistoryByName: Map<string, CostHistoryEntry[]>,
  cost: ProductCostData,
  saleDate: string
): number {
  // 옵션별 원가는 이력에 개별 추적되지 않으므로 현재 값 사용
  if (cost.option_size) return cost.unit_cost;

  const historyName = cost.base_name || cost.sale_name;
  const history = costHistoryByName.get(historyName);
  if (!history || history.length === 0) return cost.unit_cost;

  // created_at 오름차순 정렬 상태에서 saleDate 이하인 마지막 항목 찾기
  let effectiveCost: number | null = null;
  for (const h of history) {
    if (h.created_at.slice(0, 10) <= saleDate) {
      effectiveCost = h.average_unit_cost;
    } else {
      break;
    }
  }

  if (effectiveCost === null) return cost.unit_cost;
  return effectiveCost * (cost.multiplier || 1);
}
