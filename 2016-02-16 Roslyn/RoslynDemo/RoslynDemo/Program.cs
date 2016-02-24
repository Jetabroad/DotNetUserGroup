using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace RoslynDemo
{
    class Program
    {
        static void Main(string[] args)
        {
            // load this Program.cs file
            string thisFile = Directory.GetParent(Directory.GetCurrentDirectory()).Parent.FullName + @"\Program.cs";
            SyntaxTree code = CSharpSyntaxTree.ParseText(File.ReadAllText(thisFile));
            var root = code.GetRoot();

            // find all the for loops in the Main method
            var forloops = from method in root.DescendantNodes().OfType<MethodDeclarationSyntax>()
                           where method.Identifier.Text == "Main"
                           from forloop in method.DescendantNodes().OfType<ForStatementSyntax>()
                           select forloop;

            // get the for loop condition's iteration count
            var condition = forloops.First().Condition as BinaryExpressionSyntax;
            var iteration = (condition.Right as LiteralExpressionSyntax).Token;

            // update the iteration count by one
            var newroot = root.ReplaceToken(iteration, SyntaxFactory.Literal((int)iteration.Value + 1));

            for (var i = 1; i <= 5; i++)
            {
                Console.WriteLine(i);
            }

            // write out the modified syntax tree
            File.WriteAllText(thisFile, newroot.ToString());
            Console.ReadKey();
        }
    }
}
