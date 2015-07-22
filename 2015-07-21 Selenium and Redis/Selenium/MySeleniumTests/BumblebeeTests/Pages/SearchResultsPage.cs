using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bumblebee.Implementation;
using Bumblebee.Interfaces;
using Bumblebee.Setup;
using OpenQA.Selenium;

namespace BumblebeeTests.Pages
{
    class SearchResultsPage : WebBlock
    {
        public SearchResultsPage(Session session) : base(session)
        {
        }

        public IEnumerable<Clickable<StandardPage>> SearchResults()
        {
            return GetElements(By.CssSelector(".gsc-table-result a.gs-title"))
                .Select(result => new Clickable<StandardPage>(this, result))
                .ToList();
        }
    }
}
