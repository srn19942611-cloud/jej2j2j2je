import { Platform } from 'react-native';
import { fromISODate, toISODate, type ISODate } from './date';

type Options = {
  value: ISODate;
  minimumDate?: ISODate;
  maximumDate?: ISODate;
  onPick: (date: ISODate) => void;
};

/**
 * Den native datovælger indlæses først når den skal bruges. Sådan kan
 * skærmene også køre i browseren (`npm run web`), hvor modulet ikke findes.
 */
export function openDatePicker({ value, minimumDate, maximumDate, onPick }: Options): void {
  if (Platform.OS !== 'android') {
    return;
  }
  const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
  DateTimePickerAndroid.open({
    value: fromISODate(value),
    mode: 'date',
    minimumDate: minimumDate ? fromISODate(minimumDate) : undefined,
    maximumDate: maximumDate ? fromISODate(maximumDate) : undefined,
    onChange: (_event: unknown, selected?: Date) => {
      if (selected) onPick(toISODate(selected));
    },
  });
}
