import { json, type RequestEvent } from '@sveltejs/kit';

export async function POST({ request, cookies, locals }: RequestEvent) {
	try {
		const { locale } = await request.json();

		// Validate locale
		if (!locale || typeof locale !== 'string') {
			return json({ error: 'Invalid locale' }, { status: 400 });
		}

		// Check if locale is supported
		const availableLocales = locals.translationsManager.getLocales();
		if (!availableLocales.includes(locale)) {
			return json(
				{
					error: 'Unsupported locale',
					availableLocales
				},
				{ status: 400 }
			);
		}

		// Set locale cookie (expires in 1 year)
		cookies.set('locale', locale, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365, // 1 year
			httpOnly: false, // Allow client-side access
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax'
		});

		return json({
			success: true,
			locale,
			message: 'Language updated successfully'
		});
	} catch (error) {
		console.error('Language switching error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function GET({ cookies, locals }: RequestEvent) {
	// Get current locale from cookie
	const currentLocale = cookies.get('locale') || 'en-US';
	const availableLocales = locals.translationsManager.getLocales();

	return json({
		currentLocale,
		availableLocales
	});
}
