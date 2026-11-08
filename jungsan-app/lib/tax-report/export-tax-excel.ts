import * as XLSX from 'xlsx'
import type { TaxAllocationResult } from '@/lib/tax-report/allocate'

function applyNumberFormat(ws: XLSX.WorkSheet, cols: string[], fromRow: number, toRow: number) {
  for (let r = fromRow; r <= toRow; r++) {
    for (const col of cols) {
      const cell = ws[`${col}${r}`]
      if (cell && typeof cell.v === 'number') cell.z = '#,##0'
    }
  }
}

export function downloadTaxReportExcel(
  result: TaxAllocationResult,
  files: { fileName: string; period: string | null }[],
) {
  const wb = XLSX.utils.book_new()

  const header = ['연번', '성명', '주민등록번호', '세금신고금액', '소득세', '지방소득세', '원천징수세액']
  const body = result.lines.map((line, i) => [
    i + 1,
    line.reportName,
    line.ssn,
    line.finalAmount,
    line.incomeTax,
    line.localTax,
    line.incomeTax + line.localTax,
  ])
  const sum = [
    '',
    '합계',
    '',
    result.lines.reduce((s, l) => s + l.finalAmount, 0),
    result.lines.reduce((s, l) => s + l.incomeTax, 0),
    result.lines.reduce((s, l) => s + l.localTax, 0),
    result.lines.reduce((s, l) => s + l.incomeTax + l.localTax, 0),
  ]
  const filing = XLSX.utils.aoa_to_sheet([header, ...body, sum])
  filing['!cols'] = [
    { wch: 6 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ]
  applyNumberFormat(filing, ['D', 'E', 'F', 'G'], 2, body.length + 2)
  XLSX.utils.book_append_sheet(wb, filing, '세무서신고')

  const adjHeader = ['구분', '원본라이더명', '신고성명', '주민등록번호', '원본합계', '배분·충당', '차감', '최종신고금액']
  const adjBody = result.adjustments.map((row) => [
    row.kind,
    row.sourceName,
    row.reportName,
    row.ssn,
    row.originalAmount,
    row.distributed,
    row.deducted,
    row.finalAmount,
  ])
  const adj = XLSX.utils.aoa_to_sheet([adjHeader, ...adjBody])
  adj['!cols'] = [
    { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ]
  applyNumberFormat(adj, ['E', 'F', 'G', 'H'], 2, adjBody.length + 1)
  XLSX.utils.book_append_sheet(wb, adj, '조정내역')

  const summaryRows: (string | number)[][] = [
    ['항목', '값'],
    ['원본 세금신고 합계', result.originalTotal],
    ['전체신고안하기 제외', result.excludedTotal],
    ['나누기 대상 합계', result.splitTotal],
    ['정호걸 원본', result.jeongOriginal ?? 0],
    ['정호걸 최종', result.jeongFinal ?? 0],
    ['정호걸 초과분 배분', result.jeongExcess],
    ['나누기 금액 중 정호걸 충당', result.jeongFilledFromSplit],
    ['다른 라이더에서 정호걸 충당', result.jeongFilledFromOthers],
    ['1인당 배분액', result.distributedEach],
    ['10원 단위 절사', result.discarded],
    ['최종 신고 합계', result.finalTotal],
    [],
    ['처리 내용', ''],
    ...result.notes.map((note) => [note, '']),
    [],
    ['올린 파일', '정산 기간'],
    ...files.map((f) => [f.fileName, f.period ?? '']),
  ]
  const summary = XLSX.utils.aoa_to_sheet(summaryRows)
  summary['!cols'] = [{ wch: 36 }, { wch: 48 }]
  applyNumberFormat(summary, ['B'], 2, 12)
  XLSX.utils.book_append_sheet(wb, summary, '요약')

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `세무서신고_${today}.xlsx`)
}
