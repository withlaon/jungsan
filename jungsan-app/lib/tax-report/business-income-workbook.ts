import ExcelJS from 'exceljs'
import type { TaxReportLine } from '@/lib/tax-report/allocate'
import { attributionLabel, domesticForeignFlag, paymentDateLabel, ssnDigits } from '@/lib/tax-report/business-income'

const COLUMN_WIDTHS = [5.125, 9.75, 11.875, 19.125, 16.625, 23.75, 23.625, 13.25, 9.75, 15.875, 9, 12.875, 13, 13.375, 9.625]

const TITLE = ' 사업소득자료입력     ※ 본 서식은 SmartA 인사급여 사업소득자료입력 메뉴로 Excel DATA를 자동 변환하기 위한 서식입니다.'

const NOTICE = [
  '◈ 사업소득자료입력으로 엑셀 데이터를 반영하기 전 사업소득자입력의 사원정보를 먼저 작업하셔야 합니다.',
  '    ',
  '◈ 귀속월, 지급월일, 소득자명, 주민등록번호, 소득구분은 반드시 기재하셔야 합니다. 변환시 사업소득자입력의 주민(외국인)등록번호로 인식하여 변환이 됩니다.',
  '◈ 주민등록번호를 입력할 때에는 \' : / ? -"등 특수문자를 제외하고 입력하여 주십시오. ',
  '◈ 소득세와 지방소득세는 입력한 지급총액과 세율에 따라 자동 계산되어 반영되며, 직접 수정 가능합니다.',
  '◈ 세액계는 소득세와 지방소득세 금액을 합산하여 자동반영되며, 직접 수정 가능합니다.',
  '◈ 차인지급액은 지급총액에서 세액계 금액을 차감한 금액으로 자동반영되며, 직접 수정 가능합니다.',
  '◈ 연말정산 여/부 체크는 방문판매원,보험설계,음료배달 를 제외한 다른 소득구분을 여로 체크하셔도 부로 반영됩니다.',
  '◈ 입력한 주민(외국인)등록번호가 사업소득자입력에 없을경우 자동으로 소득자등록을 합니다. ',
  '◈ 사업소득자 자동등록시 내외국인구분을 입력합니다. 0.내국인1.외국인이 입력이 되어있지 않으면 내국인으로 등록됩니다.',
  '◈ 예술인/노무제공자(특고) 등록에 \'여\'로 입력된 사업소득자만 필요경비 및 고용보험료 가 계산됩니다. ',
  '',
  '▣ 본서식을 변형하여 사용시 사업소득자료입력 메뉴로 변환되지 않을 수 있습니다.',
].join('\n')

const HEADERS = ['', '귀속년월', '지급년월일', '소득자명', '주민등록번호', '기본주소', '상세주소', '소득구분', '영수일자', '지급총액', '세율(%)', '소득세', '지방소득세', '내.외국인구분', '연말정산']

const INCOME_TYPES = [
  '병의원', '저술가', '화가관련', '작곡가', '배우', '모델', '가수', '성악가', '1인미디어콘텐츠창작자', '연예보조',
  '자문/고문', '바둑기사', '꽃꽃이교사', '학원강사', '직업운동가', '봉사료수취자', '보험설계', '음료배달', '방판/외판', '기타자영업',
  '다단계판매', '기타모집수당', '간병인', '대리운전', '캐디', '목욕관리사', '행사도우미', '심부름용역', '퀵서비스', '물품배달',
  '학습지방문강사', '교육교구방문강사', '대여제품방문점검원', '대출모집인', '신용카드회원모집인', '방과후강사', '소프트웨어프리랜서',
]

const thin: ExcelJS.BorderStyle = 'thin'
const headerBorder: Partial<ExcelJS.Borders> = {
  top: { style: thin },
  left: { style: thin },
  bottom: { style: thin },
  right: { style: thin },
}

export async function buildBusinessIncomeWorkbook(lines: TaxReportLine[], month: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')

  COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
  for (let column = COLUMN_WIDTHS.length + 1; column <= 256; column += 1) {
    sheet.getColumn(column).width = 9
  }

  sheet.getRow(1).height = 48.75
  sheet.mergeCells('A1:O1')
  const title = sheet.getCell('A1')
  title.value = TITLE
  title.font = { name: '굴림', size: 25, bold: true }
  title.alignment = { horizontal: 'left', vertical: 'middle' }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0C0C0' } }

  sheet.getRow(2).height = 181.5
  sheet.mergeCells('A2:O2')
  const notice = sheet.getCell('A2')
  notice.value = NOTICE
  notice.font = { name: '굴림', size: 11, bold: true }
  notice.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }

  sheet.getRow(3).height = 23.25
  HEADERS.forEach((header, index) => {
    const cell = sheet.getCell(3, index + 1)
    cell.value = header
    cell.font = { name: '굴림', size: 11, bold: index !== 0 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF99CCFF' } }
    cell.border = headerBorder
  })

  const belong = attributionLabel(month)
  const paidOn = paymentDateLabel(month)
  lines.forEach((line, index) => {
    const rowNumber = 4 + index
    const row = sheet.getRow(rowNumber)
    row.height = 18.75
    const digits = ssnDigits(line.ssn)
    const flag = domesticForeignFlag(digits)
    setData(row.getCell(1), index + 1, { name: '굴림', size: 10 })
    setData(row.getCell(2), belong, { name: '맑은 고딕', size: 11 }, 'center')
    setData(row.getCell(3), paidOn, { name: '맑은 고딕', size: 11 }, 'center')
    setData(row.getCell(4), line.reportName, { name: '맑은 고딕', size: 11 }, 'center')
    if (digits) setData(row.getCell(5), Number(digits), { name: '맑은 고딕', size: 11 }, 'center', '0')
    setData(row.getCell(8), '퀵서비스', { name: '굴림', size: 10 }, 'center')
    setData(row.getCell(10), line.finalAmount, { name: '맑은 고딕', size: 11 })
    if (flag != null) setData(row.getCell(14), flag, { name: '맑은 고딕', size: 11 })
  })

  INCOME_TYPES.forEach((label, index) => {
    const rowNumber = 4 + index
    const row = sheet.getRow(rowNumber)
    if (!row.height) row.height = 18.75
    const cell = sheet.getCell(rowNumber, 256)
    cell.value = label
    cell.font = { name: '맑은 고딕', size: 11 }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function setData(
  cell: ExcelJS.Cell,
  value: string | number,
  font: Partial<ExcelJS.Font>,
  horizontal?: ExcelJS.Alignment['horizontal'],
  numFmt?: string,
) {
  cell.value = value
  cell.font = font
  cell.alignment = { horizontal, vertical: 'middle' }
  if (numFmt) cell.numFmt = numFmt
}
