using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Composition;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CodeFixes;
using Microsoft.CodeAnalysis.CodeActions;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Rename;
using Microsoft.CodeAnalysis.Text;

namespace NullEnumerableAnalyzer
{
    [ExportCodeFixProvider(LanguageNames.CSharp, Name = nameof(NullEnumerableAnalyzerCodeFixProvider)), Shared]
    public class NullEnumerableAnalyzerCodeFixProvider : CodeFixProvider
    {
        private readonly string title = Resources.CodeFixDescription;

        public sealed override ImmutableArray<string> FixableDiagnosticIds
        {
            get { return ImmutableArray.Create(NullEnumerableAnalyzerAnalyzer.DiagnosticId); }
        }

        public sealed override FixAllProvider GetFixAllProvider()
        {
            // See https://github.com/dotnet/roslyn/blob/master/docs/analyzers/FixAllProvider.md for more information on Fix All Providers
            return WellKnownFixAllProviders.BatchFixer;
        }

        public sealed override async Task RegisterCodeFixesAsync(CodeFixContext context)
        {
            var root = await context.Document.GetSyntaxRootAsync(context.CancellationToken).ConfigureAwait(false);

            // TODO: Replace the following code with your own analysis, generating a CodeAction for each fix to suggest
            var diagnostic = context.Diagnostics.First();
            var diagnosticSpan = diagnostic.Location.SourceSpan;

            // Find the type declaration identified by the diagnostic.
            var returnStatement = root.FindToken(diagnosticSpan.Start).Parent as ReturnStatementSyntax;
            var method = returnStatement.Parent.Ancestors().OfType<MethodDeclarationSyntax>().First();

            // Register a code action that will invoke the fix.
            context.RegisterCodeFix(
                CodeAction.Create(
                    title: title,
                    createChangedDocument: c => ReplaceWithEmptyEnumerable(context.Document, returnStatement, method, c),
                    equivalenceKey: title),
                diagnostic);
        }

        private async Task<Document> ReplaceWithEmptyEnumerable(Document document, ReturnStatementSyntax returnNullStatement, MethodDeclarationSyntax method, CancellationToken cancellationToken)
        {
            var semanticModel = await document.GetSemanticModelAsync(cancellationToken);
            var typeSymbol = semanticModel.GetSymbolInfo(method.ReturnType, cancellationToken).Symbol as INamedTypeSymbol;
            var genericTypeArgument = typeSymbol.TypeArguments.Single();

            var empty = SyntaxFactory.ParseExpression($"Enumerable.Empty<{genericTypeArgument.Name}>()");
            var returnEmptyStatement = returnNullStatement.WithExpression(empty);
            SyntaxNode root = await document.GetSyntaxRootAsync(cancellationToken);
            var newRoot = root.ReplaceNode(returnNullStatement, returnEmptyStatement);
            return document.WithSyntaxRoot(newRoot) ;
        }
    }
}