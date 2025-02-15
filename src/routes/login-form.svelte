<script lang="ts">
	import { enhance } from '$app/forms';
	import { authenticate, createUser } from '$lib/auth';
	import toast from 'svelte-french-toast';
	import { Card, Input, Label, Button } from 'flowbite-svelte';

	let username = $state('');
	let password = $state('');

	const signIn = 'sign in';
	const signUp = 'sign up';
</script>

<Card class="mx-auto w-full max-w-md">
	<form
		class="space-y-4"
		method="POST"
		use:enhance={async ({ submitter, formData, cancel }) => {
			cancel();

			const submissionType = submitter?.innerText;
			const submittedData = Object.fromEntries(formData);

			console.log(submissionType, submittedData);

			try {
				if (submissionType === signUp) {
					await createUser(submittedData.username! as string, submittedData.password! as string);
					toast.success('Account created!');
				}

				const success = await authenticate(
					submittedData.username! as string,
					submittedData.password! as string
				);

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
		<div class="text-center">
			<h1 class="text-3xl font-semibold">shush</h1>
			<h2 class="mb-8 text-xl text-gray-400">simple & private data sharing</h2>

			<ul class="mb-8 space-y-2">
				<li class="text-gray-400">
					- your account is on <span class="font-semibold">your device only</span>
				</li>
				<li class="text-gray-400">- transfer data directly from computer to computer</li>
				<li class="text-gray-400">
					- <span class="font-semibold">no</span> servers storing your data
				</li>
			</ul>
		</div>

		<div class="space-y-4">
			<div>
				<Label for="username">Username</Label>
				<Input id="username" name="username" type="text" required bind:value={username} />
			</div>

			<div>
				<Label for="password">Password</Label>
				<Input id="password" name="password" type="password" required bind:value={password} />
			</div>
		</div>

		<div class="space-y-2">
			<Button type="submit" color="purple" class="w-full">{signIn}</Button>
			<div class="text-center font-medium">or</div>
			<Button type="submit" color="dark" class="w-full border-1">{signUp}</Button>
		</div>
	</form>
</Card>
