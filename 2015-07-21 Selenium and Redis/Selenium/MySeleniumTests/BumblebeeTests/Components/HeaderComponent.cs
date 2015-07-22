using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bumblebee.Implementation;
using Bumblebee.Interfaces;
using Bumblebee.Setup;
using BumblebeeTests.Pages;
using OpenQA.Selenium;

namespace BumblebeeTests.Components
{
    interface IHeaderComponent<T> : IBlock where T : WebBlock
    {
        
    }

    static class HeaderComponent
    {
        public static IClickable<T> TitleLink<T>(this IHeaderComponent<T> header) where T : WebBlock
        {
            return new Clickable<T>(header, By.CssSelector("#header h1 a"));
        }
        public static IClickable<T> ProjectsNavigationLink<T>(this IHeaderComponent<T> header) where T : WebBlock
        {
            return new Clickable<T>(header, By.CssSelector("#menu_projects a"));
        }
        public static IClickable<T> DownloadNavigationLink<T>(this IHeaderComponent<T> header) where T : WebBlock
        {
            return new Clickable<T>(header, By.CssSelector("#menu_download a"));
        }
        public static IClickable<T> DocumentationNavigationLink<T>(this IHeaderComponent<T> header) where T : WebBlock
        {
            return new Clickable<T>(header, By.CssSelector("#menu_documentation a"));
        }
        public static IClickable<T> SupportNavigationLink<T>(this IHeaderComponent<T> header) where T : WebBlock
        {
            return new Clickable<T>(header, By.CssSelector("#menu_support a"));
        }
        public static IClickable<T> AboutNavigationLink<T>(this IHeaderComponent<T> header) where T : WebBlock
        {
            return new Clickable<T>(header, By.CssSelector("#menu_about a"));
        }
        public static ITextField<T> SearchField<T>(this IHeaderComponent<T> header) where T : WebBlock
        {
            return new TextField<T>(header, By.Id("q"));
        }
        public static IClickable<T> SearchButton<T>(this IHeaderComponent<T> header) where T : WebBlock
        {
            return new Clickable<T>(header, By.Id("submit"));
        }
        public static SearchResultsPage SearchFor<T>(this IHeaderComponent<T> header, string searchText) where T : WebBlock
        {
            header.SearchField().EnterText(searchText);
            return header.SearchButton().Click<SearchResultsPage>();
        }
    }
}
