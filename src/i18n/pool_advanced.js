/**
 * Strings for the Pool-B (advanced) entries, English and Thai.
 * Every entry uses four step keys: observe, detect, rule, verify (`pool.<entryId>.<name>`).
 * Inline LaTeX never contains braces here, so `{name}` is always a placeholder.
 */
import { registerStrings } from '../core/i18n.js';

/** @type {Record<string,string>} */
const en = {};
/** @type {Record<string,string>} */
const th = {};

/**
 * @param {string} id pool entry id
 * @param {string} name step name
 * @param {string} enText English text
 * @param {string} thText Thai text
 * @returns {void}
 */
function put(id, name, enText, thText) {
  en[`pool.${id}.${name}`] = enText;
  th[`pool.${id}.${name}`] = thText;
}

const OBSERVE_EN = 'Write down the known terms of this rule (position and value).';
const OBSERVE_TH = 'เขียนพจน์ที่ทราบค่าของกฎนี้ (ตำแหน่งและค่าของพจน์)';
const VERIFY_EN = 'Check the rule on known terms: it must give exactly the values shown in the question.';
const VERIFY_TH = 'ตรวจสอบกฎกับพจน์ที่ทราบค่า ต้องได้ค่าตรงกับที่โจทย์กำหนดทุกพจน์';

const IDS = [
  'seq.prime',
  'seq.prime_sq',
  'fact.add',
  'pow.nn_mod',
  'dig.rev_arith',
  'dig.sum_pow',
  'seq.alt_ap',
  'mix.tri_sq_alt',
  'rec.fib_gap',
  'rec.pow_sum',
  'rec.lin1',
  'rec.trib',
  'rec.alt_op',
  'rec.sum_prev',
  'rec.cum_prod',
  'rec.prod_two',
  'rec.lin2',
];

for (const id of IDS) {
  put(id, 'observe', OBSERVE_EN, OBSERVE_TH);
  put(id, 'verify', VERIFY_EN, VERIFY_TH);
}

// --- primes -----------------------------------------------------------------
put(
  'seq.prime',
  'detect',
  'Every known term is a prime number. Find which prime it is: $p_k$ is the $k$-th prime ($p_1=2$, $p_2=3$, $p_3=5$, $p_4=7$, $p_5=11$, …), then compare $k$ with the position $n$.',
  'พจน์ที่ทราบค่าทุกพจน์เป็นจำนวนเฉพาะ ให้หาว่าแต่ละพจน์เป็นจำนวนเฉพาะตัวที่เท่าใด โดย $p_k$ คือจำนวนเฉพาะตัวที่ $k$ ($p_1=2$, $p_2=3$, $p_3=5$, $p_4=7$, $p_5=11$, …) แล้วเทียบ $k$ กับตำแหน่ง $n$',
);
put(
  'seq.prime',
  'rule',
  'The difference $k-n$ is the same for every term, so the sequence lists consecutive primes starting from the {k}-th prime.',
  'ค่า $k-n$ เท่ากันทุกพจน์ แสดงว่าลำดับนี้คือจำนวนเฉพาะเรียงต่อกัน โดยเริ่มจากจำนวนเฉพาะตัวที่ {k}',
);

put(
  'seq.prime_sq',
  'detect',
  'Subtract the constant from each known term. The results are squares of primes $p_k$ ($p_1=2$, $p_2=3$, $p_3=5$, …); compare $k$ with the position $n$.',
  'นำค่าคงที่ไปลบออกจากพจน์ที่ทราบค่าแต่ละพจน์ จะได้กำลังสองของจำนวนเฉพาะ $p_k$ ($p_1=2$, $p_2=3$, $p_3=5$, …) แล้วเทียบ $k$ กับตำแหน่ง $n$',
);
put(
  'seq.prime_sq',
  'rule',
  'The prime index is a fixed shift of $n$: the sequence squares consecutive primes starting from the {k}-th prime and then adds a constant.',
  'ลำดับของจำนวนเฉพาะเลื่อนจาก $n$ เป็นค่าคงที่ ดังนั้นลำดับนี้คือกำลังสองของจำนวนเฉพาะเรียงต่อกัน เริ่มจากจำนวนเฉพาะตัวที่ {k} แล้วบวกด้วยค่าคงที่',
);

// --- factorial / power / digits ----------------------------------------------
put(
  'fact.add',
  'detect',
  'Subtract a constant so that each term becomes a factorial. Recall $1!=1$, $2!=2$, $3!=6$, $4!=24$, $5!=120$, $6!=720$.',
  'ลบค่าคงที่ออกจากแต่ละพจน์เพื่อให้ได้แฟกทอเรียล โดยจำไว้ว่า $1!=1$, $2!=2$, $3!=6$, $4!=24$, $5!=120$, $6!=720$',
);
put(
  'fact.add',
  'rule',
  'Each term is the factorial of its position plus a constant.',
  'แต่ละพจน์คือแฟกทอเรียลของตำแหน่งบวกด้วยค่าคงที่',
);

put(
  'pow.nn_mod',
  'detect',
  'Compute $n^n$ for each known position and write it as a multiple of the modulus plus a remainder. The remainder is the term.',
  'คำนวณ $n^n$ ของแต่ละตำแหน่งที่ทราบค่า แล้วเขียนให้อยู่ในรูปจำนวนเท่าของตัวหารบวกเศษ เศษที่ได้คือค่าของพจน์',
);
put(
  'pow.nn_mod',
  'rule',
  'Each term is the remainder when $n^n$ is divided by {m}.',
  'แต่ละพจน์คือเศษจากการหาร $n^n$ ด้วย {m}',
);

put(
  'dig.rev_arith',
  'detect',
  'Reverse the digits of every known term. The reversed numbers form an arithmetic sequence, so find its common difference.',
  'กลับหลักของตัวเลขในแต่ละพจน์ที่ทราบค่า จะได้ลำดับเลขคณิต ให้หาผลต่างร่วมของลำดับนั้น',
);
put(
  'dig.rev_arith',
  'rule',
  'Each term is the digit reversal of an arithmetic sequence with first term {a} and common difference {d}.',
  'แต่ละพจน์คือเลขที่กลับหลักของลำดับเลขคณิตที่มีพจน์แรก {a} และผลต่างร่วม {d}',
);

put(
  'dig.sum_pow',
  'detect',
  'Work out the power $b^n$ at each known position and add up its digits.',
  'คำนวณค่ากำลัง $b^n$ ที่แต่ละตำแหน่งที่ทราบค่า แล้วนำเลขโดดทุกหลักมาบวกกัน',
);
put(
  'dig.sum_pow',
  'rule',
  'Each term is the sum of the digits of $b^n$ with base $b={b}$.',
  'แต่ละพจน์คือผลบวกของเลขโดดทุกหลักของ $b^n$ เมื่อฐาน $b={b}$',
);

// --- interleaved patterns -----------------------------------------------------
put(
  'seq.alt_ap',
  'detect',
  'Split the terms into odd positions and even positions. Each group is an arithmetic sequence, so find the common difference of each.',
  'แยกพจน์เป็นตำแหน่งคี่และตำแหน่งคู่ แต่ละกลุ่มเป็นลำดับเลขคณิต ให้หาผลต่างร่วมของแต่ละกลุ่ม',
);
put(
  'seq.alt_ap',
  'rule',
  'Odd positions start at {a1} and change by {d1} each time; even positions start at {a2} and change by {d2} each time.',
  'ตำแหน่งคี่เริ่มที่ {a1} และเปลี่ยนครั้งละ {d1} ส่วนตำแหน่งคู่เริ่มที่ {a2} และเปลี่ยนครั้งละ {d2}',
);

put(
  'mix.tri_sq_alt',
  'detect',
  'Treat odd and even positions separately. At odd positions, removing the constant leaves squares. At even positions, removing the constant leaves triangular numbers $1, 3, 6, 10, …$.',
  'พิจารณาตำแหน่งคี่และตำแหน่งคู่แยกกัน ตำแหน่งคี่เมื่อลบค่าคงที่แล้วจะได้กำลังสองสมบูรณ์ ตำแหน่งคู่เมื่อลบค่าคงที่แล้วจะได้จำนวนสามเหลี่ยม $1, 3, 6, 10, …$',
);
put(
  'mix.tri_sq_alt',
  'rule',
  'Position $n=2k-1$ gives $k^2$ plus {m1}; position $n=2k$ gives the triangular number $k(k+1)/2$ plus {m2}.',
  'ตำแหน่ง $n=2k-1$ ได้ $k^2$ บวก {m1} และตำแหน่ง $n=2k$ ได้จำนวนสามเหลี่ยม $k(k+1)/2$ บวก {m2}',
);

// --- recurrences --------------------------------------------------------------
put(
  'rec.fib_gap',
  'detect',
  'Try to write a term as the sum of two earlier terms. Test it on a term that comes after the starting values.',
  'ลองเขียนพจน์หนึ่งให้เป็นผลบวกของพจน์ก่อนหน้าสองพจน์ โดยทดสอบกับพจน์ที่อยู่หลังพจน์เริ่มต้น',
);
put(
  'rec.fib_gap',
  'rule',
  'Each term is the sum of the term {m1} place(s) back and the term {m2} places back. The starting values are the first terms.',
  'แต่ละพจน์เท่ากับผลบวกของพจน์ที่อยู่ก่อนหน้า {m1} ตำแหน่ง และพจน์ที่อยู่ก่อนหน้า {m2} ตำแหน่ง โดยพจน์เริ่มต้นคือพจน์แรก ๆ',
);

put(
  'rec.pow_sum',
  'detect',
  'Look at the difference between neighbouring terms: it equals $2^1$, $3^2$, $4^3$, …, that is the position $n$ raised to the power $n-1$.',
  'พิจารณาผลต่างของพจน์ที่อยู่ติดกัน จะได้ $2^1$, $3^2$, $4^3$, … คือตำแหน่ง $n$ ยกกำลัง $n-1$',
);
put(
  'rec.pow_sum',
  'rule',
  'Each term is the previous term plus the position $n$ raised to the power $n-1$, starting from the given first term.',
  'แต่ละพจน์เท่ากับพจน์ก่อนหน้าบวกตำแหน่ง $n$ ยกกำลัง $n-1$ โดยเริ่มจากพจน์แรกที่กำหนด',
);

put(
  'rec.lin1',
  'detect',
  'Compare neighbouring terms: each one seems to be the previous term multiplied by a constant, plus another constant.',
  'เทียบพจน์ที่อยู่ติดกัน จะเห็นว่าแต่ละพจน์เท่ากับพจน์ก่อนหน้าคูณค่าคงที่ แล้วบวกด้วยค่าคงที่อีกตัวหนึ่ง',
);
put(
  'rec.lin1',
  'rule',
  'Each term is the previous term multiplied by {m1}, then {m2} is added.',
  'แต่ละพจน์คือพจน์ก่อนหน้าคูณ {m1} แล้วบวกด้วย {m2}',
);

put(
  'rec.trib',
  'detect',
  'Check whether a term equals the sum of the three terms before it.',
  'ตรวจดูว่าแต่ละพจน์เท่ากับผลบวกของสามพจน์ก่อนหน้าหรือไม่',
);
put(
  'rec.trib',
  'rule',
  'Each term is the sum of the three previous terms; the first three terms are the starting values.',
  'แต่ละพจน์คือผลบวกของสามพจน์ก่อนหน้า โดยสามพจน์แรกเป็นพจน์เริ่มต้น',
);

put(
  'rec.alt_op',
  'detect',
  'Look at consecutive terms: at even positions the previous term seems to be increased by a constant, at odd positions it seems to be multiplied by a constant.',
  'พิจารณาพจน์ที่อยู่ติดกัน ตำแหน่งคู่ดูเหมือนบวกพจน์ก่อนหน้าด้วยค่าคงที่ ส่วนตำแหน่งคี่ดูเหมือนคูณพจน์ก่อนหน้าด้วยค่าคงที่',
);
put(
  'rec.alt_op',
  'rule',
  'At even positions add {m1} to the previous term; at odd positions after the first, multiply the previous term by {m2}.',
  'ตำแหน่งคู่ให้บวกพจน์ก่อนหน้าด้วย {m1} ส่วนตำแหน่งคี่ที่ไม่ใช่พจน์แรกให้คูณพจน์ก่อนหน้าด้วย {m2}',
);

put(
  'rec.sum_prev',
  'detect',
  'Add up all the terms before a given term and compare the total with that term.',
  'นำพจน์ทั้งหมดที่อยู่ก่อนหน้ามาบวกกัน แล้วเทียบผลบวกกับพจน์นั้น',
);
put(
  'rec.sum_prev',
  'rule',
  'Each term equals the sum of all earlier terms plus {m1}.',
  'แต่ละพจน์เท่ากับผลบวกของทุกพจน์ก่อนหน้า บวกด้วย {m1}',
);

put(
  'rec.cum_prod',
  'detect',
  'Divide each term by the one before it. The quotients are consecutive integers.',
  'นำแต่ละพจน์หารด้วยพจน์ก่อนหน้า จะได้ผลหารที่เป็นจำนวนเต็มเรียงกัน',
);
put(
  'rec.cum_prod',
  'rule',
  'Each term is the previous term multiplied by $n+c$, where $c={m1}$.',
  'แต่ละพจน์คือพจน์ก่อนหน้าคูณด้วย $n+c$ เมื่อ $c={m1}$',
);

put(
  'rec.prod_two',
  'detect',
  'Check whether a term equals the product of the two terms before it.',
  'ตรวจดูว่าแต่ละพจน์เท่ากับผลคูณของสองพจน์ก่อนหน้าหรือไม่',
);
put(
  'rec.prod_two',
  'rule',
  'Each term is the product of the two previous terms; the first two terms are the starting values.',
  'แต่ละพจน์คือผลคูณของสองพจน์ก่อนหน้า โดยสองพจน์แรกเป็นพจน์เริ่มต้น',
);

put(
  'rec.lin2',
  'detect',
  'Look for a combination of the two previous terms, each multiplied by a constant.',
  'มองหาการรวมของสองพจน์ก่อนหน้า โดยแต่ละพจน์คูณด้วยค่าคงที่',
);
put(
  'rec.lin2',
  'rule',
  'Each term is {m1} times the previous term plus {m2} times the term before that.',
  'แต่ละพจน์คือ {m1} เท่าของพจน์ก่อนหน้า บวก {m2} เท่าของพจน์ก่อนหน้านั้นอีกหนึ่งตำแหน่ง',
);

registerStrings('en', en);
registerStrings('th', th);
