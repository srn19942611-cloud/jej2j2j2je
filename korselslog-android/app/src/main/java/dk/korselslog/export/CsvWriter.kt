package dk.korselslog.export

/** RFC 4180 quoting, with a semicolon separator so Danish Excel opens it cleanly. */
object Csv {
    const val SEPARATOR = ";"

    fun escape(value: String): String =
        if (value.contains(SEPARATOR) || value.contains('"') || value.contains('\n') || value.contains('\r')) {
            "\"" + value.replace("\"", "\"\"") + "\""
        } else {
            value
        }

    fun row(vararg cells: Any?): String =
        cells.joinToString(SEPARATOR) { escape(it?.toString().orEmpty()) } + "\n"

    /** Danish decimal comma - what TastSelv and Excel-dk expect. */
    fun number(value: Double, decimals: Int = 1): String =
        String.format(java.util.Locale("da", "DK"), "%.${decimals}f", value)
}
