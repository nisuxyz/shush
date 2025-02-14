<script lang="ts">
  import { DatePicker } from '@svelte-plugins/datepicker';
  import { format } from 'date-fns';

  // const now = new Date();

  let {
    startDate = $bindable(new Date()), disabled = false, required = false, name = undefined
  } = $props();

  // Declare reactive state using $state
  // let startDate = $state(now);
  let dateFormat = $state('MM/dd/yy hh:mma');
  let isOpen = $state(false);

  // Function to toggle the date picker
  const toggleDatePicker = () => {
    isOpen = !isOpen;
  };

  // Function to format the date
  const formatDate = (date: Date) => {
    return format(date, dateFormat);
  };

  // Derived state for the formatted start date
  let formattedStartDate = $state(formatDate(new Date()))

  // Effect to update startDate when formattedStartDate changes
  // $effect(() => {
  //   const parsedDate = new Date(formattedStartDate);
  //   if (!isNaN(parsedDate.getTime())) {
  //     startDate = parsedDate;
  //   }
  // });

  $effect(() => {
    if (formattedStartDate !== formatDate(startDate)) {
      formattedStartDate = formatDate(startDate);
      const parsedDate = new Date(formattedStartDate);
      if (!isNaN(parsedDate.getTime())) {
        startDate = parsedDate;
        console.log({startDate});
      }
    }
  })
</script>

<DatePicker bind:isOpen bind:startDate showTimePicker enableFutureDates>
  <input
    {name}
    class="border border-2 border-red-500 rounded-sm p-1 bg-gray-600 text-white dark:text-gray-900 dark:bg-white"
    type="text"
    placeholder="Select date"
    bind:value={formattedStartDate}
    onclick={toggleDatePicker}
    {disabled}
    {required}
  />
</DatePicker>

<style>
  input[type='text'] {
    border-radius: 4px;
    padding: 8px;
  }

  input[type='text']:disabled {
    border: 1px solid #e8e9ea;
    background: lightgray;
  }
</style>
