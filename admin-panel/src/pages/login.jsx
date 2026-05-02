import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const handleLogin = async () => {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) alert(error.message);
		else window.location.href = '/dashboard';
	};

	return (
		<div>
			<h2>Admin Login</h2>
			<input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
			<input
				type="password"
				placeholder="Password"
				onChange={(e) => setPassword(e.target.value)}
			/>
			<button onClick={handleLogin}>Login</button>
		</div>
	);
}
