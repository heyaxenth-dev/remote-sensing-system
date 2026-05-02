import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
	useEffect(() => {
		checkUser();
	}, []);

	const checkUser = async () => {
		const { data } = await supabase.auth.getUser();

		if (!data.user) {
			window.location.href = '/';
		}
	};

	return <h1>Admin Dashboard</h1>;
}
