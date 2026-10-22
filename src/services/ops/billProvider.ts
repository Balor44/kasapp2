import { BillPayService } from "../billpay.service";
import { VtpassService } from "../vtpass.service";
import { BillProvider, ProviderResult } from "./types";

/**
 * Adapter between the operation engine and the real bill providers.
 * params: { provider: 'FLUTTERWAVE'|'VTPASS', kind, target, amountNaira, network?, variationCode?, customerPhone? }
 * The request id is the operation's providerRef, so a retry can never buy twice.
 */
export const billProvider: BillProvider = {
  async pay(requestId, p): Promise<ProviderResult> {
    let result: any;
    if (p.provider === "VTPASS") {
      if (p.kind === "airtime" || p.kind === "data") {
        result = await VtpassService.buyAirtimeOrData(p.network, p.target, p.amountNaira, p.variationCode, requestId);
      } else if (p.kind === "electricity") {
        result = await VtpassService.payElectricity(p.network, p.target, p.amountNaira, p.customerPhone || "", requestId);
      } else {
        result = await VtpassService.payTv(p.network, p.target, p.amountNaira, p.customerPhone || "", requestId);
      }
    } else {
      const fn =
        p.kind === "airtime" ? BillPayService.buyAirtime :
        p.kind === "data" ? BillPayService.buyData :
        p.kind === "electricity" ? BillPayService.payElectricity :
        p.kind === "water" ? BillPayService.payWater : BillPayService.payCable;
      result = await fn(p.target, p.amountNaira, p.network, requestId);
    }
    if (result.success) return "DELIVERED";
    // No response from the provider means we do not know. Throw so the engine requeries instead of refunding.
    if (result.unknown) throw new Error(result.message || "Provider outcome unknown");
    return "FAILED";
  },

  async requery(requestId, p): Promise<ProviderResult> {
    return p.provider === "VTPASS" ? VtpassService.requery(requestId) : BillPayService.status(requestId);
  },
};
