import { Suspense } from 'react';

// Datos de ejemplo (mock) - reemplazarás esto cuando tengas la DB
const mockCourses = [
    { id: 1, title: "Introduction to Piano", category: "Music", instructor: "John Doe" },
    { id: 2, title: "Advanced Guitar Techniques", category: "Music", instructor: "Jane Smith" },
    { id: 3, title: "Classical Ballet Fundamentals", category: "Dance", instructor: "Maria Garcia" },
    { id: 4, title: "Digital Art Mastery", category: "Art", instructor: "Alex Johnson" },
    { id: 5, title: "Voice Training for Beginners", category: "Music", instructor: "Sarah Wilson" },
    { id: 6, title: "Contemporary Dance", category: "Dance", instructor: "Carlos Mendez" },
    { id: 7, title: "Watercolor Painting", category: "Art", instructor: "Emily Brown" },
    { id: 8, title: "Jazz Piano Improvisation", category: "Music", instructor: "Michael Davis" },
];

// Función simple de búsqueda en los datos mock
function searchCourses(query: string) {
    if (!query) return [];

    const searchTerm = query.toLowerCase();
    return mockCourses.filter(course =>
        course.title.toLowerCase().includes(searchTerm) ||
        course.category.toLowerCase().includes(searchTerm) ||
        course.instructor.toLowerCase().includes(searchTerm)
    );
}

// Componente de loading
function SearchResultsSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-secondary/50 rounded-lg animate-pulse" />
            ))}
        </div>
    );
}

// Componente de resultados
function SearchResults({ query }: { query: string }) {
    if (!query) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                    ✨ Escribe algo en el buscador para encontrar cursos
                </p>
            </div>
        );
    }

    const results = searchCourses(query);

    if (results.length === 0) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-bold mb-2">
                    No se encontraron resultados para: <span className="text-primary">{query}</span>
                </h2>
                <p className="text-muted-foreground">
                    Intenta con otros términos de búsqueda
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-2">
                    Resultados de búsqueda
                </h1>
                <p className="text-muted-foreground">
                    {results.length} {results.length === 1 ? 'curso encontrado' : 'cursos encontrados'} para: <span className="font-semibold text-foreground">{query}</span>
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {results.map((course) => (
                    <div
                        key={course.id}
                        className="p-6 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer bg-card"
                    >
                        <div className="mb-2">
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                {course.category}
              </span>
                        </div>
                        <h3 className="text-xl font-bold mb-2">{course.title}</h3>
                        <p className="text-sm text-muted-foreground">
                            👨‍🏫 {course.instructor}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function SearchPage({
                                       searchParams,
                                   }: {
    searchParams: { q?: string };
}) {
    const query = searchParams.q || '';

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <Suspense fallback={<SearchResultsSkeleton />}>
                <SearchResults query={query} />
            </Suspense>
        </div>
    );
}