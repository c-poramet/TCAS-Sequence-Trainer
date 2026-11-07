/**
 * Strings of the solution assembler (namespace gen.*).
 * Math lines are bare LaTeX; text may contain inline $...$.
 * @module i18n/gen
 */
import { registerStrings } from '../core/i18n.js';

registerStrings('en', {
  'gen.sec.given': 'Given',
  'gen.sec.rule': 'Rule: {label}',
  'gen.sec.answer': 'Finding the missing term',
  'gen.which.odd': 'odd positions (n = 1, 3, 5)',
  'gen.which.even': 'even positions (n = 2, 4, 6)',
  'gen.which.all': 'all positions',
  'gen.step.sequence':
    'The sequence has 6 terms at positions n = 1 to 6. The term at position n = {missing} is missing:',
  'gen.step.oneRule': 'A single rule produces every term of the sequence.',
  'gen.step.oddEvenSplit':
    'This sequence mixes two rules: one for odd positions and one for even positions. Splitting the terms by position:',
  'gen.step.points': 'Known terms for this rule:',
  'gen.step.ruleDefinition': 'The rule that fits these terms is defined as follows (derivation below):',
  'gen.step.oeisDefinition': 'Standard sequence definition{oeis}:',
  'gen.step.innerDefinition':
    'This rule is a composition $a_n = f(g(n))$. First, the inner function $g$:',
  'gen.step.innerTable': 'Values of the inner function $g(n)$ at the known positions:',
  'gen.step.outerSolve': 'Now find the outer function $f$ from the pairs ($g(n)$, $a_n$):',
  'gen.step.combined': 'Combined formula $a_n = f(g(n))$:',
  'gen.step.ruleAll': 'Position {n} uses the only rule.',
  'gen.step.ruleOdd': 'Position {n} is odd, so the rule for odd positions applies.',
  'gen.step.ruleEven': 'Position {n} is even, so the rule for even positions applies.',
  'gen.step.substitute': 'Substitute n = {n}:',
  'gen.step.substituteInner': 'Evaluate the inner function at n = {n}:',
  'gen.step.substituteOuter': 'Apply the outer function to $g({n}) = {inner}$:',
  'gen.step.conclusion': 'The missing term at position n = {n} is {answer}.',
});

registerStrings('th', {
  'gen.sec.given': 'โจทย์',
  'gen.sec.rule': 'กฎ: {label}',
  'gen.sec.answer': 'หาพจน์ที่หายไป',
  'gen.which.odd': 'ตำแหน่งคี่ (n = 1, 3, 5)',
  'gen.which.even': 'ตำแหน่งคู่ (n = 2, 4, 6)',
  'gen.which.all': 'ทุกตำแหน่ง',
  'gen.step.sequence':
    'ลำดับมี 6 พจน์ที่ตำแหน่ง n = 1 ถึง 6 โดยพจน์ที่ตำแหน่ง n = {missing} หายไป:',
  'gen.step.oneRule': 'ลำดับนี้ใช้กฎเพียงข้อเดียวกับทุกพจน์',
  'gen.step.oddEvenSplit':
    'ลำดับนี้ผสมกฎสองข้อ ข้อหนึ่งใช้กับตำแหน่งคี่ อีกข้อหนึ่งใช้กับตำแหน่งคู่ เมื่อแยกพจน์ตามตำแหน่งจะได้:',
  'gen.step.points': 'พจน์ที่ทราบค่าของกฎข้อนี้:',
  'gen.step.ruleDefinition': 'กฎที่สอดคล้องกับพจน์เหล่านี้นิยามได้ดังนี้ (วิธีหาอยู่ด้านล่าง):',
  'gen.step.oeisDefinition': 'นิยามลำดับมาตรฐาน{oeis}:',
  'gen.step.innerDefinition':
    'กฎข้อนี้เป็นฟังก์ชันประกอบ $a_n = f(g(n))$ เริ่มจากฟังก์ชันใน $g$ ก่อน:',
  'gen.step.innerTable': 'ค่าของฟังก์ชันใน $g(n)$ ที่ตำแหน่งที่ทราบค่า:',
  'gen.step.outerSolve': 'ต่อไปหาฟังก์ชันนอก $f$ จากคู่ ($g(n)$, $a_n$):',
  'gen.step.combined': 'สูตรรวม $a_n = f(g(n))$:',
  'gen.step.ruleAll': 'ตำแหน่ง {n} ใช้กฎข้อเดียวที่มีอยู่',
  'gen.step.ruleOdd': 'ตำแหน่ง {n} เป็นเลขคี่ จึงใช้กฎของตำแหน่งคี่',
  'gen.step.ruleEven': 'ตำแหน่ง {n} เป็นเลขคู่ จึงใช้กฎของตำแหน่งคู่',
  'gen.step.substitute': 'แทนค่า n = {n}:',
  'gen.step.substituteInner': 'หาค่าของฟังก์ชันในที่ n = {n}:',
  'gen.step.substituteOuter': 'นำ $g({n}) = {inner}$ ไปแทนในฟังก์ชันนอก:',
  'gen.step.conclusion': 'พจน์ที่หายไปที่ตำแหน่ง n = {n} คือ {answer}',
});
