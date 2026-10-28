import { strToU8, zipSync } from 'fflate'
import { colorName, isGroupColor, readRowColors } from './xlsxColors'

describe('colores de la columna A', () => {
  it('lee el relleno de cada fila por pestaña', () => {
    const xlsx = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="NOVIEMBRE" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/styles.xml': strToU8(
        '<styleSheet><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
          '<fill><patternFill patternType="solid"><fgColor rgb="FFFEFC78"/></patternFill></fill></fills>' +
          '<cellXfs count="2"><xf fillId="0"/><xf fillId="2" applyFill="1"/></cellXfs></styleSheet>',
      ),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="4"><c r="A4" s="1"><v>1</v></c><c r="B4" s="1"/></row><row r="5"><c r="A5" s="0"/></row></sheetData></worksheet>'),
    })
    expect(readRowColors(xlsx)).toEqual({ NOVIEMBRE: { 4: '#FEFC78' } })
  })

  it('nombres de color y colores que no cuentan como grupo', () => {
    expect(['#FEFC78', '#72FA78', '#73FDFF', '#FF89D8', '#306C1B', '#FA8907', '#FF7D78', '#0096FF'].map(colorName)).toEqual([
      'amarillo', 'verde', 'celeste', 'rosa', 'verde oscuro', 'naranja', 'salmón', 'azul',
    ])
    expect(isGroupColor('#FEFFFF')).toBe(false)
    expect(isGroupColor('#CFCFCF')).toBe(false)
    expect(isGroupColor('#FED9EC')).toBe(true)
  })
})
