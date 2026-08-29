package dk.korselslog

import android.app.Application
import dk.korselslog.data.KoerselslogRepository

class KoerselslogApp : Application() {
    val repository: KoerselslogRepository by lazy { KoerselslogRepository(this) }
}
