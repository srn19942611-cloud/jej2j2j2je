package dk.korselslog.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import dk.korselslog.KoerselslogApp
import dk.korselslog.data.DayMarkerEntity
import dk.korselslog.data.KoerselslogRepository
import dk.korselslog.data.PlaceEntity
import dk.korselslog.data.TripEntity
import dk.korselslog.data.toDomain
import dk.korselslog.domain.Box51Result
import dk.korselslog.domain.Classification
import dk.korselslog.domain.DayMarkerKind
import dk.korselslog.domain.SixtyDayRule
import dk.korselslog.domain.TaxYearRates
import java.time.LocalDate
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

abstract class RepositoryViewModel(app: Application) : AndroidViewModel(app) {
    protected val repository: KoerselslogRepository = (app as KoerselslogApp).repository
}

// ---------------------------------------------------------------- dashboard

data class DashboardState(
    val year: Int = LocalDate.now().year,
    val result: Box51Result? = null,
    val needsReviewCount: Int = 0,
    val daysNeedingReview: Int = 0,
    val loading: Boolean = true,
)

@OptIn(ExperimentalCoroutinesApi::class)
class DashboardViewModel(app: Application) : RepositoryViewModel(app) {

    private val _year = MutableStateFlow(LocalDate.now().year)
    val year: StateFlow<Int> = _year

    val state: StateFlow<DashboardState> = _year
        .flatMapLatest { year ->
            combine(
                repository.observeBox51(year),
                repository.observeNeedsReviewCount(),
            ) { result, reviewCount ->
                DashboardState(
                    year = year,
                    result = result,
                    needsReviewCount = reviewCount,
                    daysNeedingReview = result.days.count { !it.qualifies && it.commuteKm > 0 },
                    loading = false,
                )
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DashboardState())

    fun setYear(year: Int) { _year.value = year }

    fun availableYears(): List<Int> {
        val now = LocalDate.now().year
        return (now - 4..now).toList().reversed()
    }
}

// -------------------------------------------------------------------- trips

data class TripFilter(
    val classification: Classification? = null,
    val from: LocalDate = LocalDate.now().withDayOfYear(1),
    val to: LocalDate = LocalDate.now().withMonth(12).withDayOfMonth(31),
)

@OptIn(ExperimentalCoroutinesApi::class)
class TripsViewModel(app: Application) : RepositoryViewModel(app) {

    private val _filter = MutableStateFlow(TripFilter())
    val filter: StateFlow<TripFilter> = _filter

    val places: StateFlow<List<PlaceEntity>> = repository.observePlaces()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val trips: StateFlow<List<TripEntity>> = _filter
        .flatMapLatest { repository.observeTrips(it.from, it.to, it.classification) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setClassificationFilter(classification: Classification?) {
        _filter.value = _filter.value.copy(classification = classification)
    }

    fun setRange(from: LocalDate, to: LocalDate) {
        _filter.value = _filter.value.copy(from = from, to = to)
    }

    fun reclassify(id: Long, classification: Classification) = viewModelScope.launch {
        repository.setClassification(id, classification)
    }

    fun delete(id: Long) = viewModelScope.launch { repository.deleteTrip(id) }

    fun save(trip: TripEntity) = viewModelScope.launch {
        if (trip.id == 0L) repository.insertTrip(trip) else repository.updateTrip(trip)
    }

    fun merge(id: Long, otherId: Long) = viewModelScope.launch { repository.mergeTrips(id, otherId) }

    suspend fun load(id: Long): TripEntity? = repository.trip(id)
}

// ----------------------------------------------------------------- settings

data class SettingsState(
    val places: List<PlaceEntity> = emptyList(),
    val rates: List<TaxYearRates> = emptyList(),
    val sixtyDay: Map<Long, SixtyDayRule.Status> = emptyMap(),
)

class SettingsViewModel(app: Application) : RepositoryViewModel(app) {

    private val _sixtyDay = MutableStateFlow<Map<Long, SixtyDayRule.Status>>(emptyMap())

    val state: StateFlow<SettingsState> = combine(
        repository.observePlaces(),
        repository.observeAllRates().map { list -> list.map { it.toDomain() } },
        _sixtyDay,
    ) { places, rates, sixty ->
        SettingsState(places, rates, sixty)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SettingsState())

    init { refreshSixtyDay() }

    fun refreshSixtyDay() = viewModelScope.launch {
        _sixtyDay.value = repository.sixtyDayStatuses()
    }

    fun savePlace(place: PlaceEntity) = viewModelScope.launch {
        repository.upsertPlace(place)
        // A new or moved place changes what counts as a commute.
        repository.reclassifyUntouched()
        refreshSixtyDay()
    }

    fun deletePlace(place: PlaceEntity) = viewModelScope.launch {
        repository.deletePlace(place)
        repository.reclassifyUntouched()
    }

    fun saveRates(rates: TaxYearRates) = viewModelScope.launch { repository.saveRates(rates) }

    fun markVerified(year: Int) = viewModelScope.launch { repository.markRatesVerified(year) }

    fun reclassifyAll() = viewModelScope.launch { repository.reclassifyUntouched() }
}

// --------------------------------------------------------------- day markers

class DaysViewModel(app: Application) : RepositoryViewModel(app) {

    private val _month = MutableStateFlow(LocalDate.now().withDayOfMonth(1))
    val month: StateFlow<LocalDate> = _month

    @OptIn(ExperimentalCoroutinesApi::class)
    val markers: StateFlow<List<DayMarkerEntity>> = _month
        .flatMapLatest { repository.observeMarkers(it, it.plusMonths(1).minusDays(1)) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val trips: StateFlow<List<TripEntity>> = _month
        .flatMapLatest { repository.observeTrips(it, it.plusMonths(1).minusDays(1)) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun shiftMonth(delta: Long) { _month.value = _month.value.plusMonths(delta) }

    fun mark(date: LocalDate, kind: DayMarkerKind) = viewModelScope.launch {
        repository.setMarker(date, kind)
    }

    fun clear(date: LocalDate) = viewModelScope.launch { repository.clearMarker(date) }
}

// ------------------------------------------------------------------- export

class ExportViewModel(app: Application) : RepositoryViewModel(app) {

    suspend fun tripsFor(year: Int): List<TripEntity> =
        repository.tripsBetween(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31))

    suspend fun places(): Map<Long, PlaceEntity> = repository.placesById()

    suspend fun box51(year: Int): Box51Result = repository.box51(year)

    suspend fun rates(year: Int): TaxYearRates = repository.ratesFor(year)

    suspend fun markers(year: Int): List<DayMarkerEntity> =
        repository.markersBetween(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31))
}
