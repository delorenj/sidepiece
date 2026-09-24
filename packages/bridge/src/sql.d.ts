// `.sql` files are imported as their text: tsup inlines them (`loader: {'.sql': 'text'}`) and
// the test runner loads them through `test/sql-loader.ts`.
declare module '*.sql' {
  const sql: string;
  export default sql;
}
