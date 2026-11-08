/**
 * 挂号模块门面：外部只能从这里调用，禁止直连子目录
 */
import { acceptPrivacy, getConsentState, maskIdCard, maskPhone, resetConsent } from './consent/index.js'
import {
  clearDeviceToken,
  createBindSession,
  getDeviceToken,
  mockConfirmBind,
} from './identity/index.js'
import { findPatientById, listPatients } from './family/index.js'
import { suggestDepartment } from './triage/index.js'
import { listSlots } from './schedule/index.js'
import { assertOnline, confirmOrder, holdSlot } from './hold-order/index.js'

export const registration = {
  // consent
  acceptPrivacy,
  getConsentState,
  resetConsent,
  maskIdCard,
  maskPhone,
  // identity
  createBindSession,
  mockConfirmBind,
  getDeviceToken,
  clearDeviceToken,
  // family
  listPatients,
  findPatientById,
  // triage / schedule / order
  suggestDepartment,
  listSlots,
  holdSlot,
  confirmOrder,
  assertOnline,
}

export default registration
