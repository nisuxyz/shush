<script lang="ts">
  import { enhance } from '$app/forms';
  import { authenticate, createUser } from '$lib/auth';
  import toast from 'svelte-french-toast';

  let username = $state('');
  let password = $state('');

  const signIn = 'sign in';
  const signUp = 'sign up';
</script>

<form
  class="flex flex-col p-4"
  method="POST"
  use:enhance={async({ submitter, formData, cancel }) => {
    cancel();

    const submissionType = submitter?.innerText;
    const submittedData = Object.fromEntries(formData);

    console.log(submissionType, submittedData);

    try {
      if (submissionType === signUp) {
        await createUser(submittedData.username! as string, submittedData.password! as string);
        toast.success('Account created!');
      }

      const success = await authenticate(submittedData.username! as string, submittedData.password! as string);
      
      if (!success) {
        toast.error('Incorrect password');
        return;
      }

      toast.success('Signed in!');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          toast.error('User not found');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    }
  }}
>
  <div>
    <h1 class="text-3xl font-semibold text-center text-white">shush</h1>
    <h2 class="mb-8 text-xl text-center text-gray-400">simple & private data sharing</h2>

    <ul class="mb-8">
      <li>
        <p class="text-gray-400 text-center">- your account is on <b>your device only</b></p>
      </li>
      <!-- <p class="text-gray-400 text-center"></p> -->
      <li>
        <p class="text-gray-400 text-center">- transfer data directly from computer to computer</p>
      </li>
      <li>
        <p class="text-gray-400 text-center">- <b>no</b> servers storing your data</p>
      </li>
    </ul>
    <div class="flex-col flex">
      <label for="username" class="text-gray-300">username</label>
      <input name="username" required class="border border-1 rounded-sm p-1 bg-gray-600 text-white dark:text-gray-900 dark:bg-white" type="text" bind:value={username}/>
    </div>
    <div class="flex flex-col mb-4">
      <label for="password" class="text-gray-300">password</label>
      <input id="password" name="password" required class="border border-1 rounded-sm p-1 bg-gray-600 text-white dark:text-gray-900 dark:bg-white" type="password" bind:value={password}/>
    </div>
  </div>
  <button class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 border border-gray-700 rounded" type="submit">{signIn}</button>
  <span class="text-center text-md font-semibold text-gray-300">or</span>
  <button class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 border border-gray-700 rounded" type="submit">{signUp}</button>
</form>

<style>
  #password:disabled {
    background: lightgray;
  }
</style>
