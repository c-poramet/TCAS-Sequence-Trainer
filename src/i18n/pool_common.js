import { registerStrings } from '../core/i18n.js';

const ids = ['poly.lin','poly.quad','geo.pure','poly.shift_sq','poly.shift_cube','seq.triangular','poly.cubic','geo.offset','poly.nprod','seq.alt_sign','rec.fib','exp.pow2','poly.diff2','seq.step3'];
const en = {}, th = {};
for (const id of ids) {
  en[`pool.${id}.observe`] = 'List the known terms with their positions.';
  en[`pool.${id}.detect`] = 'Look for the pattern described by the differences, ratios, or signs.';
  en[`pool.${id}.rule`] = 'Use the normalized rule shown below.';
  en[`pool.${id}.verify`] = 'Substitute known positions to verify the rule.';
  th[`pool.${id}.observe`] = 'เขียนพจน์ที่ทราบค่าพร้อมตำแหน่งของพจน์';
  th[`pool.${id}.detect`] = 'สังเกตรูปแบบจากผลต่าง อัตราส่วน หรือเครื่องหมายของพจน์';
  th[`pool.${id}.rule`] = 'ใช้กฎมาตรฐานที่แสดงด้านล่าง';
  th[`pool.${id}.verify`] = 'แทนค่าตำแหน่งที่ทราบเพื่อยืนยันกฎ';
}
registerStrings('en', en);
registerStrings('th', th);
