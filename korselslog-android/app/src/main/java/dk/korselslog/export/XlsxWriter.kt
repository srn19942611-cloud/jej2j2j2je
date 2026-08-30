package dk.korselslog.export

import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * A minimal .xlsx writer.
 *
 * An xlsx file is a zip of XML parts, so writing one directly avoids pulling
 * Apache POI - several megabytes of library, built for the JVM rather than
 * Android - into the app just to emit two tables. Strings are written inline,
 * which skips the shared-string table entirely.
 *
 * Deliberately narrow: text, numbers, and three cell styles. Enough for a
 * driving log, and small enough to be worth verifying by hand.
 */
object Xlsx {

    sealed interface Cell {
        data class Text(val value: String, val bold: Boolean = false) : Cell
        /** [decimals] drives the display format only; the stored value is exact. */
        data class Number(val value: Double, val decimals: Int = 1) : Cell
        data class Whole(val value: Long) : Cell
        data object Empty : Cell
    }

    data class Sheet(val name: String, val rows: List<List<Cell>>)

    // Style indices, in the order they are written into styles.xml.
    private const val STYLE_DEFAULT = 0
    private const val STYLE_BOLD = 1
    private const val STYLE_ONE_DECIMAL = 2
    private const val STYLE_TWO_DECIMALS = 3
    private const val STYLE_WHOLE = 4

    fun build(sheets: List<Sheet>): ByteArray {
        require(sheets.isNotEmpty()) { "A workbook needs at least one sheet" }

        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            zip.put("[Content_Types].xml", contentTypes(sheets.size))
            zip.put("_rels/.rels", rootRels())
            zip.put("xl/workbook.xml", workbook(sheets))
            zip.put("xl/_rels/workbook.xml.rels", workbookRels(sheets.size))
            zip.put("xl/styles.xml", styles())
            sheets.forEachIndexed { index, sheet ->
                zip.put("xl/worksheets/sheet${index + 1}.xml", worksheet(sheet))
            }
        }
        return out.toByteArray()
    }

    private fun ZipOutputStream.put(path: String, content: String) {
        putNextEntry(ZipEntry(path))
        write(content.toByteArray(Charsets.UTF_8))
        closeEntry()
    }

    // ---- parts -----------------------------------------------------------

    private fun contentTypes(sheetCount: Int): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">""")
        append("""<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>""")
        append("""<Default Extension="xml" ContentType="application/xml"/>""")
        append("""<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>""")
        append("""<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>""")
        for (i in 1..sheetCount) {
            append("""<Override PartName="/xl/worksheets/sheet$i.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>""")
        }
        append("</Types>")
    }

    private fun rootRels(): String =
        """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""" +
            """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">""" +
            """<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>""" +
            """</Relationships>"""

    private fun workbook(sheets: List<Sheet>): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" """)
        append("""xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">""")
        append("<sheets>")
        sheets.forEachIndexed { index, sheet ->
            append("""<sheet name="${escape(sheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>""")
        }
        append("</sheets></workbook>")
    }

    private fun workbookRels(sheetCount: Int): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">""")
        for (i in 1..sheetCount) {
            append("""<Relationship Id="rId$i" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet$i.xml"/>""")
        }
        append("""<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>""")
        append("</Relationships>")
    }

    private fun styles(): String =
        """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""" +
            """<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""" +
            // 164/165 are the first ids available for custom formats.
            """<numFmts count="2">""" +
            """<numFmt numFmtId="164" formatCode="0.0"/>""" +
            """<numFmt numFmtId="165" formatCode="0.00"/>""" +
            """</numFmts>""" +
            """<fonts count="2">""" +
            """<font><sz val="11"/><name val="Calibri"/></font>""" +
            """<font><b/><sz val="11"/><name val="Calibri"/></font>""" +
            """</fonts>""" +
            """<fills count="2"><fill><patternFill patternType="none"/></fill>""" +
            """<fill><patternFill patternType="gray125"/></fill></fills>""" +
            """<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>""" +
            """<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>""" +
            """<cellXfs count="5">""" +
            """<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>""" +
            """<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>""" +
            """<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>""" +
            """<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>""" +
            """<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>""" +
            """</cellXfs>""" +
            """<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>""" +
            """</styleSheet>"""

    private fun worksheet(sheet: Sheet): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>""")
        sheet.rows.forEachIndexed { rowIndex, row ->
            val rowNumber = rowIndex + 1
            append("""<row r="$rowNumber">""")
            row.forEachIndexed { columnIndex, cell ->
                val ref = "${columnName(columnIndex)}$rowNumber"
                when (cell) {
                    is Cell.Empty -> Unit
                    is Cell.Text -> {
                        val style = if (cell.bold) STYLE_BOLD else STYLE_DEFAULT
                        append("""<c r="$ref" s="$style" t="inlineStr"><is><t xml:space="preserve">""")
                        append(escape(cell.value))
                        append("""</t></is></c>""")
                    }
                    is Cell.Number -> {
                        val style = if (cell.decimals >= 2) STYLE_TWO_DECIMALS else STYLE_ONE_DECIMAL
                        append("""<c r="$ref" s="$style"><v>${plain(cell.value)}</v></c>""")
                    }
                    is Cell.Whole ->
                        append("""<c r="$ref" s="$STYLE_WHOLE"><v>${cell.value}</v></c>""")
                }
            }
            append("</row>")
        }
        append("</sheetData></worksheet>")
    }

    // ---- helpers ---------------------------------------------------------

    /** A1-style column name: 0 -> A, 25 -> Z, 26 -> AA. */
    fun columnName(index: Int): String {
        require(index >= 0) { "Column index cannot be negative" }
        var remaining = index
        val name = StringBuilder()
        while (true) {
            name.insert(0, ('A' + remaining % 26))
            remaining = remaining / 26 - 1
            if (remaining < 0) break
        }
        return name.toString()
    }

    /**
     * Excel rejects a sheet name over 31 characters or containing : \ / ? * [ ]
     * and silently corrupts the file rather than complaining.
     */
    fun sheetName(raw: String): String {
        val cleaned = raw.map { if (it in ":\\/?*[]") ' ' else it }.joinToString("")
        return cleaned.take(31).ifBlank { "Ark" }
    }

    /** Always a dot decimal separator: the file format is locale-independent. */
    private fun plain(value: Double): String =
        if (value == value.toLong().toDouble()) {
            value.toLong().toString()
        } else {
            String.format(java.util.Locale.US, "%.6f", value).trimEnd('0').trimEnd('.')
        }

    fun escape(value: String): String = buildString(value.length) {
        for (ch in value) {
            when {
                ch == '&' -> append("&amp;")
                ch == '<' -> append("&lt;")
                ch == '>' -> append("&gt;")
                ch == '"' -> append("&quot;")
                ch == '\'' -> append("&apos;")
                // XML 1.0 forbids most control characters outright; dropping
                // them is better than writing a file Excel refuses to open.
                ch.code < 0x20 && ch != '\n' && ch != '\t' -> Unit
                else -> append(ch)
            }
        }
    }
}
