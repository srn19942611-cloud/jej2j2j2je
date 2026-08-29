package dk.korselslog.tracking

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

/**
 * Doze and OEM battery managers are the usual reason a background tracker
 * "works for a day and then stops".
 *
 * Stock Android will not kill a foreground service outright, but it will defer
 * its wake-ups once the app is considered idle - and several manufacturers go
 * further and kill background processes regardless of foreground-service state.
 * Being on the battery-optimisation exemption list is what stops that.
 */
object BatteryOptimisation {

    fun isExempt(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return true
        return power.isIgnoringBatteryOptimizations(context.packageName)
    }

    /**
     * Opens the system prompt asking to exempt this app.
     *
     * Uses ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, which shows a single
     * dialog. If the OEM has removed it, fall back to the general list so the
     * user can at least find the setting.
     */
    fun requestExemption(context: Context): Intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            @Suppress("BatteryLife")
            Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:${context.packageName}"),
            )
        } else {
            Intent(Settings.ACTION_SETTINGS)
        }

    fun batterySettingsIntent(): Intent =
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)

    /**
     * Manufacturers that run their own process killer on top of Android's, and
     * where the exemption above is not enough on its own.
     */
    fun needsExtraOemSetup(): Boolean =
        Build.MANUFACTURER.lowercase() in setOf(
            "xiaomi", "redmi", "poco", "huawei", "honor", "oppo", "realme",
            "oneplus", "vivo", "samsung", "meizu", "asus",
        )

    fun oemAdvice(): String = when (Build.MANUFACTURER.lowercase()) {
        "samsung" ->
            "Samsung: Indstillinger → Batteri → Baggrundsbegrænsninger. " +
                "Sæt Kørselslog til \"Ubegrænset\", og slå den fra under " +
                "\"Apps i dvale\"."
        "xiaomi", "redmi", "poco" ->
            "Xiaomi: Indstillinger → Apps → Kørselslog → Batterisparer → " +
                "\"Ingen begrænsninger\", og slå Autostart til."
        "huawei", "honor" ->
            "Huawei: Indstillinger → Batteri → Appstart → Kørselslog → " +
                "administrér manuelt, med alle tre kontakter slået til."
        "oppo", "realme", "oneplus" ->
            "OPPO/OnePlus: Indstillinger → Batteri → Batterioptimering → " +
                "Kørselslog → \"Optimér ikke\", og tillad baggrundskørsel."
        "vivo" ->
            "vivo: Indstillinger → Batteri → Baggrundsforbrug → tillad " +
                "Kørselslog at køre i baggrunden."
        else ->
            "Din telefonproducent kan have sin egen batterisparer ud over " +
                "Androids. Find Kørselslog i batteriindstillingerne og tillad " +
                "den at køre frit i baggrunden."
    }
}
