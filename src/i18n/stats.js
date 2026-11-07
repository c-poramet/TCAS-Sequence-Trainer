/**
 * Strings for `stats.*`, `trainer.*` and `print.*` (en + th).
 * Placeholders use {name}; digits are always Arabic.
 * @module i18n/stats
 */
import { registerStrings } from '../core/i18n.js';

registerStrings('en', {
  // print
  'print.title': 'TGAT2 Number Sequence Practice',
  'print.setId': 'Set ID:',
  'print.setQrLabel': 'QR code for this set ID',
  'print.questionQrLabel': 'QR code for this question ID',
  'print.scanInstruction': 'Scan the QR code beside a question to see its solution.',
  'print.count': '{count} questions',
  'print.answers': 'Answer key',
  'print.solutions': 'Worked solutions',
  'print.answerMc': '{label} ({value})',

  // trainer
  'trainer.bucket.easy': 'Easy for you',
  'trainer.bucket.normal': 'Normal',
  'trainer.bucket.hard': 'Hard for you',
  'trainer.bucket.failed': 'Often failed',

  // stats: general
  'stats.title': 'Statistics',
  'stats.loading': 'Loading…',
  'stats.empty': 'No attempts recorded yet. Practice a few questions and your statistics will appear here.',
  'stats.noCharts': 'Charts are unavailable because the chart library could not be loaded.',
  'stats.na': '–',
  'stats.yes': 'Yes',
  'stats.no': 'No',
  'stats.value.percent': '{value}%',
  'stats.value.seconds': '{value} s',
  'stats.clear': 'Clear all statistics',
  'stats.clearConfirm': 'Delete all recorded attempts? This cannot be undone.',

  // stats: overview
  'stats.overview.title': 'Overview',
  'stats.overview.attempts': 'Attempts',
  'stats.overview.accuracy': 'Accuracy',
  'stats.overview.median': 'Median time (correct answers)',
  'stats.overview.streak': 'Current streak',
  'stats.overview.bestStreak': 'Best streak',
  'stats.overview.days': 'Days practised',
  'stats.overview.normalMode': 'Normal questions',
  'stats.overview.hardMode': 'Hard questions',
  'stats.overview.modeValue': '{attempts} attempts, {accuracy}% correct',

  // stats: tiers and buckets
  'stats.tier.easy': 'Easy',
  'stats.tier.normal': 'Normal',
  'stats.tier.hard': 'Hard',
  'stats.tier.unrated': 'Unrated',
  'stats.buckets.title': 'Practice groups',
  'stats.bucket.note': 'Functions with too few attempts are listed under Normal.',
  'stats.bucket.empty': 'No functions',

  // stats: table
  'stats.table.title': 'Functions, weakest first',
  'stats.table.fn': 'Function',
  'stats.table.attempts': 'Attempts',
  'stats.table.accuracy': 'Accuracy',
  'stats.table.median': 'Median',
  'stats.table.p25': '25th percentile',
  'stats.table.p75': '75th percentile',
  'stats.table.tier': 'Your level',
  'stats.table.failed': 'Often failed',

  // stats: charts
  'stats.charts.title': 'Charts',
  'stats.chart.time.caption': 'Median answer time per function (bar = 25th to 75th percentile, marker = median)',
  'stats.chart.results.caption': 'Correct and wrong answers per function',
  'stats.chart.trend.caption': 'Accuracy and median time over time',
  'stats.chart.hist.caption': 'Distribution of answer times (correct answers)',
  'stats.chart.median': 'Median',
  'stats.chart.seconds': 'Seconds',
  'stats.chart.correct': 'Correct',
  'stats.chart.wrong': 'Wrong or skipped',
  'stats.chart.count': 'Questions',
  'stats.chart.accuracy': 'Accuracy (%)',
  'stats.chart.medianSeconds': 'Median time (s)',
  'stats.chart.attempts': 'Attempts so far',
  'stats.chart.binLabel': '{from}–{to}',
});

registerStrings('th', {
  // print
  'print.title': 'แบบฝึกหัดอนุกรมตัวเลข TGAT2',
  'print.setId': 'รหัสชุดข้อสอบ:',
  'print.setQrLabel': 'คิวอาร์โค้ดสำหรับรหัสชุดโจทย์นี้',
  'print.questionQrLabel': 'คิวอาร์โค้ดสำหรับรหัสโจทย์ข้อนี้',
  'print.scanInstruction': 'สแกนคิวอาร์โค้ดข้างโจทย์แต่ละข้อเพื่อดูวิธีทำ',
  'print.count': '{count} ข้อ',
  'print.answers': 'เฉลย',
  'print.solutions': 'เฉลยละเอียด',
  'print.answerMc': '{label} ({value})',

  // trainer
  'trainer.bucket.easy': 'ง่ายสำหรับคุณ',
  'trainer.bucket.normal': 'ปานกลาง',
  'trainer.bucket.hard': 'ยากสำหรับคุณ',
  'trainer.bucket.failed': 'ผิดบ่อย',

  // stats: general
  'stats.title': 'สถิติ',
  'stats.loading': 'กำลังโหลด…',
  'stats.empty': 'ยังไม่มีบันทึกการทำข้อสอบ ลองฝึกทำโจทย์สักสองสามข้อ แล้วสถิติจะแสดงที่นี่',
  'stats.noCharts': 'ไม่สามารถแสดงกราฟได้ เนื่องจากโหลดไลบรารีกราฟไม่สำเร็จ',
  'stats.na': '–',
  'stats.yes': 'ใช่',
  'stats.no': 'ไม่ใช่',
  'stats.value.percent': '{value}%',
  'stats.value.seconds': '{value} วินาที',
  'stats.clear': 'ล้างสถิติทั้งหมด',
  'stats.clearConfirm': 'ต้องการลบบันทึกการทำข้อสอบทั้งหมดหรือไม่ การลบนี้ไม่สามารถย้อนกลับได้',

  // stats: overview
  'stats.overview.title': 'ภาพรวม',
  'stats.overview.attempts': 'จำนวนครั้งที่ทำ',
  'stats.overview.accuracy': 'ความแม่นยำ',
  'stats.overview.median': 'เวลามัธยฐาน (ข้อที่ตอบถูก)',
  'stats.overview.streak': 'ตอบถูกติดต่อกันตอนนี้',
  'stats.overview.bestStreak': 'ตอบถูกติดต่อกันสูงสุด',
  'stats.overview.days': 'จำนวนวันที่ฝึก',
  'stats.overview.normalMode': 'โจทย์โหมดปกติ',
  'stats.overview.hardMode': 'โจทย์โหมดยาก',
  'stats.overview.modeValue': '{attempts} ครั้ง ตอบถูก {accuracy}%',

  // stats: tiers and buckets
  'stats.tier.easy': 'ง่าย',
  'stats.tier.normal': 'ปานกลาง',
  'stats.tier.hard': 'ยาก',
  'stats.tier.unrated': 'ยังไม่ประเมิน',
  'stats.buckets.title': 'กลุ่มสำหรับฝึก',
  'stats.bucket.note': 'ฟังก์ชันที่ทำน้อยเกินไปจะอยู่ในกลุ่มปานกลาง',
  'stats.bucket.empty': 'ไม่มีฟังก์ชัน',

  // stats: table
  'stats.table.title': 'ฟังก์ชันเรียงจากจุดอ่อนที่สุด',
  'stats.table.fn': 'ฟังก์ชัน',
  'stats.table.attempts': 'จำนวนครั้ง',
  'stats.table.accuracy': 'ความแม่นยำ',
  'stats.table.median': 'มัธยฐาน',
  'stats.table.p25': 'เปอร์เซ็นไทล์ที่ 25',
  'stats.table.p75': 'เปอร์เซ็นไทล์ที่ 75',
  'stats.table.tier': 'ระดับของคุณ',
  'stats.table.failed': 'ผิดบ่อย',

  // stats: charts
  'stats.charts.title': 'กราฟ',
  'stats.chart.time.caption': 'เวลาตอบมัธยฐานของแต่ละฟังก์ชัน (แท่ง = เปอร์เซ็นไทล์ที่ 25 ถึง 75, จุด = มัธยฐาน)',
  'stats.chart.results.caption': 'จำนวนข้อที่ตอบถูกและตอบผิดของแต่ละฟังก์ชัน',
  'stats.chart.trend.caption': 'ความแม่นยำและเวลามัธยฐานตามช่วงเวลา',
  'stats.chart.hist.caption': 'การกระจายของเวลาตอบ (เฉพาะข้อที่ตอบถูก)',
  'stats.chart.median': 'มัธยฐาน',
  'stats.chart.seconds': 'วินาที',
  'stats.chart.correct': 'ถูก',
  'stats.chart.wrong': 'ผิดหรือข้าม',
  'stats.chart.count': 'จำนวนข้อ',
  'stats.chart.accuracy': 'ความแม่นยำ (%)',
  'stats.chart.medianSeconds': 'เวลามัธยฐาน (วินาที)',
  'stats.chart.attempts': 'จำนวนครั้งสะสม',
  'stats.chart.binLabel': '{from}–{to}',
});