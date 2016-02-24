using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Threading;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Diagnostics;

namespace NullEnumerableAnalyzer
{
    [DiagnosticAnalyzer(LanguageNames.CSharp)]
    public class NullEnumerableAnalyzerAnalyzer : DiagnosticAnalyzer
    {
        public const string DiagnosticId = "NullEnumerableAnalyzer";

        // You can change these strings in the Resources.resx file. If you do not want your analyzer to be localize-able, you can use regular strings for Title and MessageFormat.
        // See https://github.com/dotnet/roslyn/blob/master/docs/analyzers/Localizing%20Analyzers.md for more on localization
        private static readonly LocalizableString Title = new LocalizableResourceString(nameof(Resources.AnalyzerTitle), Resources.ResourceManager, typeof(Resources));
        private static readonly LocalizableString MessageFormat = new LocalizableResourceString(nameof(Resources.AnalyzerMessageFormat), Resources.ResourceManager, typeof(Resources));
        private static readonly LocalizableString Description = new LocalizableResourceString(nameof(Resources.AnalyzerDescription), Resources.ResourceManager, typeof(Resources));
        private const string Category = "Best Practices";

        private static DiagnosticDescriptor Rule = new DiagnosticDescriptor(DiagnosticId, Title, MessageFormat, Category, DiagnosticSeverity.Warning, isEnabledByDefault: true, description: Description);

        public override ImmutableArray<DiagnosticDescriptor> SupportedDiagnostics { get { return ImmutableArray.Create(Rule); } }

        public override void Initialize(AnalysisContext context)
        {
            context.RegisterSyntaxNodeAction(Analyze, SyntaxKind.ReturnStatement);
        }

        private static void Analyze(SyntaxNodeAnalysisContext context)
        {
            var returnStatement = context.Node as ReturnStatementSyntax;
            if(returnStatement.Expression.IsKind(SyntaxKind.NullLiteralExpression))
            {
                var returnType = context.Node.Ancestors().OfType<MethodDeclarationSyntax>().FirstOrDefault()?.ReturnType as GenericNameSyntax;
                if (returnType?.Identifier.Text == "IEnumerable")
                {
                    var diagnostic = Diagnostic.Create(Rule, returnStatement.GetLocation());
                    context.ReportDiagnostic(diagnostic);
                }
            }
        }
    }
}
