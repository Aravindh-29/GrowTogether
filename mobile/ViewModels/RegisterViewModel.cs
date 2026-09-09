using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CombinedStudies.Mobile.Services;

namespace CombinedStudies.Mobile.ViewModels;

public partial class RegisterViewModel(IAuthService authService) : ObservableObject
{
    [ObservableProperty] private string displayName = "";
    [ObservableProperty] private string email = "";
    [ObservableProperty] private string password = "";
    [ObservableProperty] private string errorMessage = "";
    [ObservableProperty] private bool isBusy;

    [RelayCommand]
    private async Task RegisterAsync()
    {
        if (string.IsNullOrWhiteSpace(DisplayName) || string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password)) return;
        if (Password.Length < 8)
        {
            ErrorMessage = "Password must be at least 8 characters.";
            return;
        }

        ErrorMessage = "";
        IsBusy = true;
        try
        {
            await authService.RegisterAsync(Email, Password, DisplayName);
            await Shell.Current.GoToAsync("//home");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            ErrorMessage = "That email is already registered.";
        }
        catch
        {
            ErrorMessage = "Something went wrong. Please try again.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task GoToLoginAsync() =>
        await Shell.Current.GoToAsync("//login");
}
