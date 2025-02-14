<script lang="ts">
	import { userSaltWritable } from "$lib/auth";
  import EShareForm from "./e-share-form.svelte";
	import LoginForm from "./login-form.svelte";
  import FloatingMenu from "$lib/components/floating-menu.svelte";

</script>

<div class="w-full h-screen flex flex-col justify-center items-center bg-gray-900 gap-1">
  {#if !$userSaltWritable}
    <LoginForm />
  {:else}
    <EShareForm/>
    <FloatingMenu/>
  {/if}
</div>

<style>

</style>
