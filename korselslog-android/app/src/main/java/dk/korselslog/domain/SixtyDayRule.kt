package dk.korselslog.domain

import java.time.LocalDate

/**
 * 60-dages-reglen (ligningsloven § 9 B).
 *
 * Relevant when the workplace varies rather than being one fixed office: driving
 * from home to a workplace you have visited on 60 days or fewer within the
 * preceding 12 months is *erhvervsmæssig*; from day 61 that workplace counts as
 * fixed and the driving becomes ordinary commuting.
 *
 * This affects which ledger a trip belongs in, so the app surfaces the counter
 * per workplace and warns as a location approaches the limit. It does not
 * silently re-classify anything - the user decides.
 *
 * Simplification worth knowing about: the statute also resets the count after a
 * 60-consecutive-working-day absence from a location. This implements the
 * rolling 12-month distinct-day count only, which is the stricter reading.
 */
object SixtyDayRule {

    const val LIMIT_DAYS = 60

    data class Visit(val placeId: Long, val date: LocalDate)

    data class Status(
        val placeId: Long,
        val daysInWindow: Int,
        val limit: Int,
        val windowStart: LocalDate,
        val windowEnd: LocalDate,
    ) {
        /** Still a temporary workplace -> driving there may be erhverv. */
        val isTemporaryWorkplace: Boolean get() = daysInWindow <= limit
        val daysRemaining: Int get() = (limit - daysInWindow).coerceAtLeast(0)
        /** Close enough to the limit to be worth flagging in the UI. */
        val approachingLimit: Boolean get() = isTemporaryWorkplace && daysRemaining <= 10
    }

    fun evaluate(
        visits: List<Visit>,
        asOf: LocalDate,
        limit: Int = LIMIT_DAYS,
    ): Map<Long, Status> {
        val windowStart = asOf.minusMonths(12).plusDays(1)
        return visits
            .filter { !it.date.isBefore(windowStart) && !it.date.isAfter(asOf) }
            .groupBy { it.placeId }
            .mapValues { (placeId, placeVisits) ->
                Status(
                    placeId = placeId,
                    // Distinct calendar days - several trips to one store in a
                    // day are still one day against the limit.
                    daysInWindow = placeVisits.map { it.date }.distinct().size,
                    limit = limit,
                    windowStart = windowStart,
                    windowEnd = asOf,
                )
            }
    }
}
